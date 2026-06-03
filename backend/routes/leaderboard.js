const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const leaderboardController = require('../controllers/leaderboardController');

// Public leaderboard endpoints (protected read)
router.get('/teams', protect, leaderboardController.getTopTeams);
router.get('/students', protect, leaderboardController.getTopStudents);

module.exports = router;
