const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/scheduleController');

router.use(protect);

// Panels (event owner / admin manage; faculty can list)
router.get('/events/:eventId/panels', authorize('faculty', 'admin'), c.listPanels);
router.post('/events/:eventId/panels', authorize('faculty', 'admin'), c.createPanel);
router.put('/events/:eventId/panels/:panelId', authorize('faculty', 'admin'), c.updatePanel);
router.delete('/events/:eventId/panels/:panelId', authorize('faculty', 'admin'), c.deletePanel);

// Scheduling
router.post('/events/:eventId/presentations/:presentationId/auto', authorize('faculty', 'admin'), c.autoSchedule);
router.get('/events/:eventId/presentations/:presentationId/slots', authorize('faculty', 'admin'), c.getSlots);
router.post('/events/:eventId/presentations/:presentationId/publish', authorize('faculty', 'admin'), c.publish);
router.patch('/slots/:slotId', authorize('faculty', 'admin'), c.updateSlot);

// Reschedule requests
router.post('/slots/:slotId/reschedule-request', authorize('student'), c.requestReschedule);
router.patch('/slots/:slotId/reschedule-request', authorize('faculty', 'admin'), c.decideReschedule);

// Personal schedule + calendar export
router.get('/my', authorize('student', 'faculty'), c.mySlots);
router.get('/my/calendar.ics', authorize('student', 'faculty'), c.myCalendar);
router.get('/slots/:slotId/calendar.ics', authorize('student', 'faculty'), c.slotCalendar);

module.exports = router;
