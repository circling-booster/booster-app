const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, adminAuthMiddleware } = require('../middleware/authMiddleware');

router.get('/admin/users', adminAuthMiddleware, adminController.getAllUsers);
router.get('/admin/subscriptions/pending', adminAuthMiddleware, adminController.getPendingSubscriptions);
router.post('/admin/subscriptions/:subscriptionId/approve', adminAuthMiddleware, adminController.approveSubscription);
router.post('/admin/subscriptions/:subscriptionId/reject', adminAuthMiddleware, adminController.rejectSubscription);
router.post('/admin/users/:userId/block', adminAuthMiddleware, adminController.blockUser);
router.post('/admin/users/:userId/unblock', adminAuthMiddleware, adminController.unblockUser);
router.get('/admin/stats', adminAuthMiddleware, adminController.getSystemStats);

module.exports = router;