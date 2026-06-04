const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const superAdmin = require('../controllers/superAdminController');

router.use(protect, authorize('super_admin'));

router.get('/dashboard', superAdmin.getDashboard);
router.put('/colleges/:collegeId/subscription', superAdmin.updateCollegeSubscription);

module.exports = router;
