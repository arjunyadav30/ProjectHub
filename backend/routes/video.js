const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { scheduleTeamMeeting, getTeamMeetingAttendance, sendTeamMeetingReminder } = require('../controllers/videoController');

router.use(protect);
router.put('/teams/:teamId/schedule', scheduleTeamMeeting);
router.get('/teams/:teamId/attendance', getTeamMeetingAttendance);
router.post('/teams/:teamId/reminder', sendTeamMeetingReminder);

module.exports = router;
