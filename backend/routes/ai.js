const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getRecommendations } = require('../controllers/aiController');

router.use(protect);
router.get('/recommendations', authorize('student'), getRecommendations);

module.exports = router;
