const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getEvents, getEvent, createEvent, updateEvent, deleteEvent,
  getEventTeams, exportTeamsCSV, updatePresentationSchedule,
} = require('../controllers/eventController');

router.use(protect);

router.get('/', getEvents);
router.post('/', authorize('admin', 'faculty'), createEvent);
router.get('/:id', getEvent);
router.put('/:id', authorize('admin', 'faculty'), updateEvent);
router.delete('/:id', authorize('admin', 'faculty'), deleteEvent);
router.get('/:id/teams', authorize('admin', 'faculty'), getEventTeams);
router.get('/:id/teams/export', authorize('admin', 'faculty'), exportTeamsCSV);
router.put('/:id/presentation-schedule', authorize('admin', 'faculty'), updatePresentationSchedule);

module.exports = router;
