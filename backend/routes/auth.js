const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const {
  signup,
  login,
  signupProjectHub,
  signupHackathonHub,
  loginProjectHub,
  loginHackathonHub,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  completeProfile,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

router.post('/signup', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['student', 'faculty', 'admin', 'hackathon_admin', 'hackathon_user']).withMessage('Valid role required'),
], validateRequest, signup);
router.post('/projecthub/signup', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['student', 'faculty', 'admin']).withMessage('Valid role required'),
], validateRequest, signupProjectHub);
router.post('/hackathonhub/signup', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['hackathon_admin', 'hackathon_user']).withMessage('Valid hackathon role required'),
], validateRequest, signupHackathonHub);

router.post('/login', authLimiter, login);
router.post('/projecthub/login', authLimiter, loginProjectHub);
router.post('/hackathonhub/login', authLimiter, loginHackathonHub);
router.post('/logout', protect, logout);
router.post('/refresh-token', refreshToken);
router.post('/change-password', protect, changePassword);
router.post('/complete-profile', protect, completeProfile);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
