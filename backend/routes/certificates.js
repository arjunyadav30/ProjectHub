const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const certificateController = require('../controllers/certificateController');

// Create certificate record (admin/faculty)
router.post('/', protect, authorize('admin', 'faculty'), certificateController.createCertificate);

// List certificates for a user (self or admin)
router.get('/user/:id?', protect, certificateController.getUserCertificates);

// Get certificate
router.get('/:id', protect, certificateController.getCertificate);

module.exports = router;
