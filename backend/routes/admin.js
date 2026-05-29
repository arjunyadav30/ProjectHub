const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');
const admin = require('../controllers/adminController');

router.use(protect, authorize('admin'), checkSubscription);

// Dashboard
router.get('/dashboard', admin.getDashboardStats);

// Students
router.get('/students', admin.getStudents);
router.post('/students', admin.addStudent);
router.post('/students/bulk-import', admin.bulkImportStudents);
router.put('/students/promote', admin.promoteStudents);
router.get('/students/export', admin.exportStudents);
router.get('/students/template', admin.downloadStudentTemplate);
router.put('/students/:id', admin.updateStudent);
router.delete('/students/:id', admin.deleteStudent);

// Faculty
router.get('/faculty', admin.getFaculty);
router.post('/faculty', admin.addFaculty);
router.post('/faculty/bulk-import', admin.bulkImportFaculty);
router.get('/faculty/template', admin.downloadFacultyTemplate);
router.put('/faculty/:id', admin.updateFaculty);
router.delete('/faculty/:id', admin.deleteFaculty);

// Website
router.get('/website-config', admin.getWebsiteConfig);
router.put('/website-config', admin.updateWebsiteConfig);
router.put('/college', admin.updateCollege);

// Featured projects
router.post('/feature-project', admin.featureProject);
router.delete('/feature-project/:team_id', admin.unfeatureProject);

// Marks
router.get('/teams/:teamId/marks', admin.getTeamMarks);
router.post('/marks', admin.giveMarks);

// Event-related
router.get('/events/:eventId/unregistered', admin.getUnregisteredStudents);
router.get('/events/:eventId/unregistered/export', admin.exportUnregisteredStudents);

module.exports = router;
