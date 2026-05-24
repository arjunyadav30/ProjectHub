const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getProjectBoard,
  addModuleEnhanced,
  bulkUpdateModules,
  addModuleComment,
  startTimer,
  stopTimer,
  getWorkload,
  getSprintAnalytics,
  getDashboard,
  createSavedView,
  globalSearch,
} = require('../controllers/projectController');

router.use(protect);

router.get('/search/global', globalSearch);
router.get('/teams/:id/board', getProjectBoard);
router.post('/teams/:id/tasks', addModuleEnhanced);
router.put('/teams/:id/tasks/bulk', bulkUpdateModules);
router.post('/teams/:id/tasks/:moduleId/comments', addModuleComment);
router.post('/teams/:id/tasks/:moduleId/timer/start', startTimer);
router.post('/teams/:id/tasks/:moduleId/timer/stop', stopTimer);
router.get('/teams/:id/workload', getWorkload);
router.get('/teams/:id/sprint-analytics', getSprintAnalytics);
router.get('/teams/:id/dashboard', getDashboard);
router.post('/teams/:id/saved-views', createSavedView);

module.exports = router;
