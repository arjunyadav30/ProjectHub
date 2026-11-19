const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/contributionController');

router.use(protect);
router.post('/repo/preview', authorize('student', 'faculty', 'admin'), c.previewRepo);
router.put('/teams/:teamId/repo', authorize('student', 'faculty', 'admin'), c.setTeamRepo);
router.get('/teams/:teamId/onboarding', authorize('student', 'faculty', 'admin'), c.getOnboarding);
router.get('/events/:eventId/onboarding', authorize('faculty', 'admin'), c.getEventOnboarding);
router.post('/events/:eventId/onboarding/remind', authorize('faculty', 'admin'), c.remindOnboarding);
router.post('/events/:eventId/analyze-all', authorize('faculty', 'admin'), c.startAnalyzeAll);
router.get('/events/:eventId/analyze-all/:jobId', authorize('faculty', 'admin'), c.getAnalyzeAllStatus);
router.post('/teams/:teamId/generate', authorize('faculty', 'admin'), c.generateReport);
router.get('/teams/:teamId/latest', authorize('faculty', 'admin'), c.getLatestReport);
router.put('/teams/:teamId/author-map', authorize('faculty', 'admin', 'student'), c.setAuthorMap);
router.put('/reports/:reportId/decision', authorize('faculty', 'admin'), c.saveDecision);
router.get('/events/:eventId/summary', authorize('faculty', 'admin'), c.eventSummary);

module.exports = router;
