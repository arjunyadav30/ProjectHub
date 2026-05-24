const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getAdvancedAnalytics } = require('../controllers/analyticsController');

router.use(protect);
router.get('/advanced', authorize('admin'), getAdvancedAnalytics);

module.exports = router;
