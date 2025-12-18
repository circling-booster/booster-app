const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/webhooks', authMiddleware, webhookController.registerWebhook);
router.get('/webhooks', authMiddleware, webhookController.getUserWebhooks);

module.exports = router;