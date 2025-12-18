const dashboardService = require('../services/dashboardService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');

async function getDashboard(req, res) {
    try {
        const userId = req.user.userId;
        const stats = await dashboardService.getDashboardStats(userId);
        
        successResponse(res, stats, '대시보드 통계 조회 성공');
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
}

async function getApiLogs(req, res) {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20 } = req.query;
        
        const result = await dashboardService.getApiLogs(userId, parseInt(page), parseInt(limit));
        
        successResponse(res, result, 'API 로그 조회 성공');
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
}

module.exports = {
    getDashboard,
    getApiLogs
};