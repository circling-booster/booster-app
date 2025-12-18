const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/dashboard/stats', authMiddleware, dashboardController.getDashboard);
router.get('/dashboard/logs', authMiddleware, dashboardController.getApiLogs);

module.exports = router;