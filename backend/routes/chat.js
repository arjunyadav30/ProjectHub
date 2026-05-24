const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const chat = require('../controllers/chatController');

router.use(protect);

router.get('/contacts', chat.getChatContacts);
router.get('/search-users', chat.searchUsers);
router.get('/group/:teamId', chat.getGroupMessages);
router.post('/group/:teamId', chat.sendGroupMessage);
router.get('/direct/:userId', chat.getDirectMessages);
router.post('/direct/:userId', chat.sendDirectMessage);
router.put('/:type/:id/read', chat.markThreadRead);
router.delete('/message/:id', chat.deleteMessage);

module.exports = router;
