const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getRecommendations, generateProjectSummary, reviewProjectCode } = require('../controllers/aiController');

router.use(protect);
router.get('/recommendations', authorize('student'), getRecommendations);
router.post('/teams/:teamId/summary', generateProjectSummary);
router.post('/teams/:teamId/code-review', reviewProjectCode);

module.exports = router;
