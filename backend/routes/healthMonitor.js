const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/healthMonitorController');

router.use(protect);
router.get('/events/:eventId', authorize('faculty', 'admin'), c.getEventHealth);
router.get('/teams/:teamId', authorize('faculty', 'admin', 'student'), c.getTeamHealth);
router.post('/teams/:teamId/check', authorize('faculty', 'admin', 'student'), c.checkNow);

module.exports = router;
