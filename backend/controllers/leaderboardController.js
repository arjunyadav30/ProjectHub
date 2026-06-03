const Team = require('../models/Team');
const Award = require('../models/Award');
const Student = require('../models/Student');
const User = require('../models/User');
const apiResponse = require('../utils/apiResponse');

const getTopTeams = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const college_id = req.query.college_id || null;
    const event_id = req.query.event_id || null;

    const filter = {};
    if (college_id) filter.college_id = college_id;
    if (event_id) filter.event_id = event_id;

    const teams = await Team.find(filter).lean().populate('members.student_id', 'name enrollment_no').limit(500);
    const enriched = teams.map(t => ({
      _id: t._id,
      team_name: t.team_name,
      percent: (t.project?.modules?.length > 0) ? Math.round((t.project.modules.filter(m => m.status === 'completed').length / t.project.modules.length) * 100) : 0,
      completed_modules: t.project?.modules?.filter(m => m.status === 'completed').length || 0,
      members: t.members || [],
      created_at: t.created_at,
    }));

    enriched.sort((a, b) => b.percent - a.percent || b.completed_modules - a.completed_modules || (new Date(b.created_at) - new Date(a.created_at)));
    return apiResponse.success(res, enriched.slice(0, limit));
  } catch (err) { next(err); }
};

const getTopStudents = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    // Rank students by number of awards
    const agg = await Award.aggregate([
      { $group: { _id: '$user_id', awards: { $sum: 1 } } },
      { $sort: { awards: -1 } },
      { $limit: limit },
    ]);
    const userIds = agg.map(a => a._id);
    const users = await User.find({ _id: { $in: userIds } }).select('name email profile_image role').lean();
    const usersMap = new Map(users.map(u => [u._id.toString(), u]));
    const result = agg.map(a => ({ user: usersMap.get(a._id.toString()) || { _id: a._id }, awards: a.awards }));
    return apiResponse.success(res, result);
  } catch (err) { next(err); }
};

module.exports = { getTopTeams, getTopStudents };
