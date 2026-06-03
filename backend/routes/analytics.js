const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getAdvancedAnalytics, getGamification } = require('../controllers/analyticsController');

router.use(protect);
router.get('/advanced', authorize('admin'), getAdvancedAnalytics);
router.get('/gamification', authorize('admin', 'faculty', 'student'), getGamification);

module.exports = router;
