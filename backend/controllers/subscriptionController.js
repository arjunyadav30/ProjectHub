const Subscription = require('../models/Subscription');
const College = require('../models/College');
const apiResponse = require('../utils/apiResponse');
const { MONTHLY_PRICE, YEARLY_PRICE } = require('../config/subscription');

exports.getStatus = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      college_id: req.user.college_id,
      admin_id: req.user._id,
    }).sort({ created_at: -1 });
    if (!subscription) return apiResponse.error(res, 'Subscription not found', 404);
    return apiResponse.success(res, {
      subscription,
      pricing: { monthly: MONTHLY_PRICE, yearly: YEARLY_PRICE },
    });
  } catch (err) { return next(err); }
};

exports.activate = async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!['monthly', 'yearly'].includes(plan)) return apiResponse.error(res, 'Invalid plan', 400);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (plan === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);
    const amount = plan === 'yearly' ? YEARLY_PRICE : MONTHLY_PRICE;

    const subscription = await Subscription.findOneAndUpdate(
      { college_id: req.user.college_id, admin_id: req.user._id },
      {
        plan,
        status: 'active',
        started_at: now,
        expires_at: expiresAt,
        amount_paid: amount,
      },
      { new: true, upsert: true }
    );
    await College.findByIdAndUpdate(req.user.college_id, { subscription_status: 'active' });
    return apiResponse.success(res, subscription, 'Subscription activated');
  } catch (err) { return next(err); }
};
