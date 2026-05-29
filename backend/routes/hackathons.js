const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  adminCreateHackathon,
  adminUpdateHackathon,
  adminDeleteHackathon,
  adminAssignJudges,
  adminPublishResults,
  getAllHackathons,
  getHackathonById,
  studentRegister,
  studentSubmit,
  judgeGetAssigned,
  judgeGetSubmissions,
  judgeScoreSubmission,
  getLeaderboard,
} = require('../controllers/hackathonController');

router.get('/', getAllHackathons);
router.get('/judge/assigned', protect, authorize('faculty'), judgeGetAssigned);
router.get('/:id', getHackathonById);
router.get('/:id/judge/submissions', protect, authorize('faculty'), judgeGetSubmissions);
router.get('/:id/leaderboard', getLeaderboard);

router.post('/', protect, authorize('admin'), adminCreateHackathon);
router.put('/:id', protect, authorize('admin'), adminUpdateHackathon);
router.delete('/:id', protect, authorize('admin'), adminDeleteHackathon);
router.post('/:id/judges', protect, authorize('admin'), adminAssignJudges);
router.post('/:id/publish-results', protect, authorize('admin'), adminPublishResults);

router.post('/:id/register', protect, authorize('student'), studentRegister);
router.post('/:id/submit', protect, authorize('student'), studentSubmit);

router.post('/:id/submissions/:submissionId/score', protect, authorize('faculty'), judgeScoreSubmission);

module.exports = router;
