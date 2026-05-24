const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const faculty = require('../controllers/facultyController');

router.use(protect, authorize('faculty', 'admin'));

router.get('/assigned-teams', faculty.getAssignedTeams);
router.get('/mentor-requests', faculty.getMentorRequests);
router.put('/mentor-requests/:id', faculty.respondMentorRequest);
router.post('/teams/:id/suggestion', faculty.addSuggestion);
router.post('/teams/:id/marks', faculty.giveMarks);
router.get('/teams/:id/marks', faculty.getTeamMarks);
router.post('/teams/:id/submission-review', faculty.reviewSubmission);

module.exports = router;
