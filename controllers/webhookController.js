const webhookService = require('../services/webhookService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');

async function registerWebhook(req, res) {
    try {
        const userId = req.user.userId;
        const { webhookUrl, eventType } = req.body;
        
        if (!webhookUrl || !eventType) {
            return errorResponse(res, 'Webhook URL과 Event Type은 필수입니다', 400);
        }
        
        const result = await webhookService.registerWebhook(userId, webhookUrl, eventType);
        
        successResponse(res, result, 'Webhook이 등록되었습니다', 201);
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
}

async function getUserWebhooks(req, res) {
    try {
        const userId = req.user.userId;
        const webhooks = await webhookService.getUserWebhooks(userId);
        
        successResponse(res, webhooks, 'Webhook 목록 조회 성공');
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
}

module.exports = {
    registerWebhook,
    getUserWebhooks
};