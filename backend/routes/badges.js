const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const badgeController = require('../controllers/badgeController');

// Public list
router.get('/', badgeController.listBadges);

// Create badge (admin only)
router.post('/', protect, authorize('admin'), badgeController.createBadge);

// Award badge (admin/faculty)
router.post('/award', protect, authorize('admin', 'faculty'), badgeController.awardBadge);

// Get badges for a user
router.get('/user/:id?', protect, badgeController.getUserBadges);

module.exports = router;
