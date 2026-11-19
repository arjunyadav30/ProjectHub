const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/panelController');

router.use(protect, authorize('faculty', 'admin'));

// Live examiner screens
router.get('/slots/:slotId/scoresheet', c.getScoresheet);
router.post('/slots/:slotId/start', c.startSlot);
router.post('/slots/:slotId/complete', c.completeSlot);
router.put('/slots/:slotId/score', c.submitScore);

// Results and dashboard (event owner / admin)
router.get('/events/:eventId/presentations/:presentationId/leaderboard', c.leaderboard);
router.post('/events/:eventId/presentations/:presentationId/finalize', c.finalize);
router.get('/events/:eventId/dashboard', c.dashboard);

module.exports = router;
