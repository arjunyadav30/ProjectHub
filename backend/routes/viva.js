const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { startCommitViva, submitCommitViva } = require('../controllers/commitVivaController');
const { startVivaSession, submitVivaAnswers, addFacultyVivaReview, getMyVivaSessions, getTeamVivaSessions, getVivaSessionReport } = require('../controllers/vivaController');

router.use(protect);
router.get('/my-sessions', authorize('student'), getMyVivaSessions);
router.post('/start', authorize('student'), startVivaSession);
router.post('/commit/start', authorize('student'), startCommitViva);
router.post('/commit/submit', authorize('student'), submitCommitViva);
router.post('/submit', authorize('student'), submitVivaAnswers);
router.post('/faculty-review', authorize('faculty', 'admin'), addFacultyVivaReview);
router.get('/team/:teamId', authorize('faculty', 'admin'), getTeamVivaSessions);
router.get('/report/:sessionId', getVivaSessionReport);

module.exports = router;
