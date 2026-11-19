const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/evaluationController');

router.use(protect);
router.get('/my', authorize('student'), c.myGrades);
router.get('/events/:eventId/grades', authorize('faculty', 'admin'), c.getEventGrades);
router.get('/events/:eventId/grades.csv', authorize('faculty', 'admin'), c.exportCsv);
router.put('/events/:eventId/weights', authorize('faculty', 'admin'), c.setWeights);
router.post('/events/:eventId/finalize', authorize('faculty', 'admin'), c.finalize);
router.get('/teams/:teamId/grades', authorize('faculty', 'admin'), c.getTeamGrades);
router.put('/teams/:teamId/report-score', authorize('faculty', 'admin'), c.setReportScore);
router.put('/grades/:gradeId/override', authorize('faculty', 'admin'), c.setOverride);

module.exports = router;
