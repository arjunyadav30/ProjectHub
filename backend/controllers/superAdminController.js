const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Admin = require('../models/Admin');
const College = require('../models/College');
const Event = require('../models/Event');
const Team = require('../models/Team');
const Subscription = require('../models/Subscription');
const apiResponse = require('../utils/apiResponse');

const toId = (value) => value?.toString();

const countByCollege = async (Model, match = {}) => {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: '$college_id', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map(row => [toId(row._id), row.count]));
};

const getLatestSubscriptionsByCollege = async () => {
  const subscriptions = await Subscription.find({})
    .sort({ created_at: -1 })
    .populate('admin_id', 'name email')
    .lean();

  const latest = new Map();
  subscriptions.forEach(subscription => {
    const collegeId = toId(subscription.college_id);
    if (collegeId && !latest.has(collegeId)) latest.set(collegeId, subscription);
  });
  return latest;
};

exports.getDashboard = async (req, res, next) => {
  try {
    const [
      colleges,
      totalUsers,
      totalStudents,
      totalFaculty,
      totalAdmins,
      totalEvents,
      totalTeams,
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      studentCounts,
      facultyCounts,
      adminCounts,
      eventCounts,
      teamCounts,
      latestSubscriptions,
    ] = await Promise.all([
      College.find({}).sort({ created_at: -1 }).lean(),
      User.countDocuments({ status: 'active' }),
      Student.countDocuments({ status: 'active' }),
      Faculty.countDocuments({ status: 'active' }),
      Admin.countDocuments({}),
      Event.countDocuments({}),
      Team.countDocuments({}),
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ status: 'trial' }),
      Subscription.countDocuments({ status: 'expired' }),
      countByCollege(Student, { status: 'active' }),
      countByCollege(Faculty, { status: 'active' }),
      countByCollege(Admin),
      countByCollege(Event),
      countByCollege(Team),
      getLatestSubscriptionsByCollege(),
    ]);

    const collegeUsage = colleges.map(college => {
      const collegeId = toId(college._id);
      const subscription = latestSubscriptions.get(collegeId) || null;
      return {
        ...college,
        usage: {
          students: studentCounts.get(collegeId) || 0,
          faculty: facultyCounts.get(collegeId) || 0,
          admins: adminCounts.get(collegeId) || 0,
          events: eventCounts.get(collegeId) || 0,
          teams: teamCounts.get(collegeId) || 0,
        },
        subscription,
      };
    });

    return apiResponse.success(res, {
      summary: {
        colleges: colleges.length,
        users: totalUsers,
        students: totalStudents,
        faculty: totalFaculty,
        admins: totalAdmins,
        events: totalEvents,
        teams: totalTeams,
        subscriptions: {
          active: activeSubscriptions,
          trial: trialSubscriptions,
          expired: expiredSubscriptions,
        },
      },
      colleges: collegeUsage,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateCollegeSubscription = async (req, res, next) => {
  try {
    const { collegeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(collegeId)) {
      return apiResponse.error(res, 'Invalid college id', 400);
    }

    const { plan, status, expires_at, amount_paid, payment_id } = req.body;
    if (plan && !['monthly', 'yearly'].includes(plan)) {
      return apiResponse.error(res, 'Invalid plan', 400);
    }
    if (status && !['active', 'inactive', 'trial', 'expired'].includes(status)) {
      return apiResponse.error(res, 'Invalid status', 400);
    }

    const college = await College.findById(collegeId);
    if (!college) return apiResponse.error(res, 'College not found', 404);

    const collegeAdmin = await Admin.findOne({ college_id: collegeId }).select('user_id');
    if (!collegeAdmin?.user_id) {
      return apiResponse.error(res, 'College admin not found for subscription ownership', 404);
    }

    let subscription = await Subscription.findOne({ college_id: collegeId }).sort({ created_at: -1 });
    if (!subscription) {
      subscription = new Subscription({
        college_id: collegeId,
        admin_id: collegeAdmin.user_id,
        plan: plan || 'monthly',
        status: status || 'trial',
        started_at: new Date(),
        expires_at: expires_at ? new Date(expires_at) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        amount_paid: amount_paid || 0,
      });
    }

    if (plan) subscription.plan = plan;
    if (status) subscription.status = status;
    if (expires_at) subscription.expires_at = new Date(expires_at);
    if (amount_paid !== undefined) subscription.amount_paid = Number(amount_paid) || 0;
    if (payment_id !== undefined) subscription.payment_id = payment_id;

    await subscription.save();

    const collegeStatus = ['active', 'trial', 'expired'].includes(subscription.status)
      ? subscription.status
      : 'expired';
    await College.findByIdAndUpdate(collegeId, { subscription_status: collegeStatus });

    return apiResponse.success(res, subscription, 'Subscription updated');
  } catch (err) {
    next(err);
  }
};
