const Badge = require('../models/Badge');
const Award = require('../models/Award');
const User = require('../models/User');
const apiResponse = require('../utils/apiResponse');

const createBadge = async (req, res, next) => {
  try {
    const { key, name, description, icon, auto_award_event, meta } = req.body;
    if (!key || !name) return apiResponse.error(res, 'key and name are required', 400);
    const badge = await Badge.create({ key, name, description, icon, auto_award_event, meta });
    return apiResponse.created(res, badge, 'Badge created');
  } catch (err) { next(err); }
};

const listBadges = async (req, res, next) => {
  try {
    const badges = await Badge.find({}).sort({ createdAt: -1 });
    return apiResponse.success(res, badges);
  } catch (err) { next(err); }
};

const awardBadge = async (req, res, next) => {
  try {
    const { badge_id, badge_key, user_id, reason, meta } = req.body;
    let badge = null;
    if (badge_id) badge = await Badge.findById(badge_id);
    else if (badge_key) badge = await Badge.findOne({ key: badge_key });
    if (!badge) return apiResponse.error(res, 'Badge not found', 404);
    const user = await User.findById(user_id);
    if (!user) return apiResponse.error(res, 'User not found', 404);

    // Prevent duplicate award for same badge unless meta forces
    const existing = await Award.findOne({ badge_id: badge._id, user_id });
    if (existing) return apiResponse.error(res, 'Badge already awarded to this user', 400);

    const award = await Award.create({ badge_id: badge._id, user_id, awarded_by: req.user._id, reason, meta });
    return apiResponse.created(res, award, 'Badge awarded');
  } catch (err) { next(err); }
};

const getUserBadges = async (req, res, next) => {
  try {
    const userId = req.params.id || req.user._id;
    const awards = await Award.find({ user_id: userId }).populate('badge_id').sort({ awarded_at: -1 });
    return apiResponse.success(res, awards.map(a => ({ _id: a._id, badge: a.badge_id, awarded_at: a.awarded_at, awarded_by: a.awarded_by, reason: a.reason })));
  } catch (err) { next(err); }
};

module.exports = { createBadge, listBadges, awardBadge, getUserBadges };
