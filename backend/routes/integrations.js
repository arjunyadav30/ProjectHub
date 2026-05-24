const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { connectGithubRepo, syncGithubRepo, getGithubRepoData } = require('../controllers/integrationController');

router.use(protect);
router.post('/github/teams/:teamId/connect', connectGithubRepo);
router.post('/github/teams/:teamId/sync', syncGithubRepo);
router.get('/github/teams/:teamId', getGithubRepoData);

module.exports = router;
