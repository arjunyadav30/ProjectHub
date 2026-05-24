const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createTeam, getTeam, getMyTeams, updateTeam, respondLeader, respondMemberInvite,
  assignFaculty, updateRegistrationStatus, addModule, updateModule, deleteModule,
  addProgressUpdate, updateProject, addMember, removeMember, leaveTeam, getVideoRoom, joinVideoRoom,
} = require('../controllers/teamController');

router.use(protect);

router.get('/', getMyTeams);
router.post('/', createTeam);
router.get('/:id', getTeam);
router.put('/:id', updateTeam);
router.post('/:id/accept-leader', respondLeader);
router.post('/:id/members/respond', respondMemberInvite);
router.post('/:id/members', addMember);
router.delete('/:id/members/:studentId', removeMember);
router.post('/:id/leave', authorize('student'), leaveTeam);
router.put('/:id/assign-faculty', authorize('faculty', 'admin'), assignFaculty);
router.put('/:id/status', authorize('faculty', 'admin'), updateRegistrationStatus);
router.put('/:id/project', updateProject);
router.post('/:id/modules', addModule);
router.put('/:id/modules/:moduleId', updateModule);
router.delete('/:id/modules/:moduleId', deleteModule);
router.post('/:id/progress-update', addProgressUpdate);
router.get('/:id/video-room', getVideoRoom);
router.post('/:id/video-room/join', joinVideoRoom);

module.exports = router;
