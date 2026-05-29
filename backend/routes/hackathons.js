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
  getMyHackathons,
  studentRegister,
  studentSubmit,
  judgeGetAssigned,
  judgeGetSubmissions,
  judgeScoreSubmission,
  getLeaderboard,
} = require('../controllers/hackathonController');

router.get('/', getAllHackathons);
router.get('/mine', protect, getMyHackathons);
router.get('/judge/assigned', protect, authorize('faculty'), judgeGetAssigned);
router.get('/:id', getHackathonById);
router.get('/:id/judge/submissions', protect, authorize('faculty'), judgeGetSubmissions);
router.get('/:id/leaderboard', getLeaderboard);

router.post('/', protect, adminCreateHackathon);
router.put('/:id', protect, adminUpdateHackathon);
router.delete('/:id', protect, adminDeleteHackathon);
router.post('/:id/judges', protect, adminAssignJudges);
router.post('/:id/publish-results', protect, adminPublishResults);

router.post('/:id/register', protect, studentRegister);
router.post('/:id/submit', protect, studentSubmit);

router.post('/:id/submissions/:submissionId/score', protect, authorize('faculty'), judgeScoreSubmission);

module.exports = router;
