const Subscription = require('../models/Subscription');
const apiResponse = require('../utils/apiResponse');

exports.checkSubscription = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') return next();

    const subscription = await Subscription.findOne({
      college_id: req.user.college_id,
      admin_id: req.user._id,
    }).sort({ created_at: -1 });

    if (!subscription) return apiResponse.error(res, 'Subscription not found. Please activate.', 403);

    const now = new Date();
    if (subscription.expires_at && new Date(subscription.expires_at) < now) {
      if (subscription.status !== 'expired') {
        subscription.status = 'expired';
        await subscription.save({ validateBeforeSave: false });
      }
      return apiResponse.error(res, 'Subscription expired. Please renew.', 403);
    }
    return next();
  } catch (err) { return next(err); }
};
