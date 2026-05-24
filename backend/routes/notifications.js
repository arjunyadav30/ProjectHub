const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const apiResponse = require('../utils/apiResponse');
const { protect } = require('../middleware/auth');
const { enrichNotifications } = require('../utils/notifications');

router.use(protect);

// GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Support both user_id and recipient fields
    const query = {
      $or: [
        { user_id: req.user._id },
        { recipient: req.user._id },
      ],
      type: { $nin: ['chat_message', 'direct_message'] },
    };

    const [rawNotifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, is_read: false }),
    ]);

    const notifications = await enrichNotifications(rawNotifications, req.user._id);

    return apiResponse.success(res, {
      notifications,
      unreadCount,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) { next(error); }
});

// PUT /api/notifications/read-all  (must be before /:id/read)
router.put('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { $or: [{ user_id: req.user._id }, { recipient: req.user._id }], is_read: false },
      { is_read: true }
    );
    return apiResponse.success(res, null, 'All notifications marked as read');
  } catch (error) { next(error); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, $or: [{ user_id: req.user._id }, { recipient: req.user._id }] },
      { is_read: true }
    );
    return apiResponse.success(res, null, 'Notification marked as read');
  } catch (error) { next(error); }
});

module.exports = router;
