const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getResumeData, downloadPortfolioHtml } = require('../controllers/portfolioController');

router.use(protect);
router.get('/resume', authorize('student'), getResumeData);
router.get('/portfolio-html', authorize('student'), downloadPortfolioHtml);

module.exports = router;
