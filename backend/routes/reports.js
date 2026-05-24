const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getMyReport, saveMyReport, getTemplateLockData, saveTemplateLockData, downloadTemplateLockedDocx } = require('../controllers/reportController');

router.use(protect);
router.get('/student/minor-project', authorize('student'), getMyReport);
router.put('/student/minor-project', authorize('student'), saveMyReport);
router.get('/student/minor-project/template-lock', authorize('student'), getTemplateLockData);
router.put('/student/minor-project/template-lock', authorize('student'), saveTemplateLockData);
router.get('/student/minor-project/template-lock/download', authorize('student'), downloadTemplateLockedDocx);

module.exports = router;