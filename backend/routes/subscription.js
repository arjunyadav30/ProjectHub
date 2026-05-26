const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getStatus, activate } = require('../controllers/subscriptionController');

router.use(protect, authorize('admin'));
router.get('/status', getStatus);
router.post('/activate', activate);

module.exports = router;
