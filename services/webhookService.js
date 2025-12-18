const { executeQuery, executeNonQuery } = require('../config/database');
const { createHmacSignature } = require('../utils/cryptoUtils');
const axios = require('axios');

async function registerWebhook(userId, webhookUrl, eventType) {
    try {
        const webhookId = require('crypto').randomUUID();
        const secretToken = require('crypto').randomBytes(32).toString('hex');
        
        await executeNonQuery(
            `INSERT INTO [Webhooks] 
             (id, user_id, webhook_url, event_type, secret_token)
             VALUES (@id, @userId, @url, @eventType, @secretToken)`,
            {
                id: webhookId,
                userId,
                url: webhookUrl,
                eventType,
                secretToken
            }
        );
        
        return { webhookId, secretToken };
    } catch (err) {
        throw err;
    }
}

async function getUserWebhooks(userId) {
    try {
        const webhooks = await executeQuery(
            `SELECT id, webhook_url, event_type, is_active, created_at FROM [Webhooks]
             WHERE user_id = @userId`,
            { userId }
        );
        
        return webhooks;
    } catch (err) {
        throw err;
    }
}

async function triggerWebhook(userId, eventType, eventData) {
    try {
        // 해당 이벤트를 등록한 Webhook 찾기
        const webhooks = await executeQuery(
            `SELECT id, webhook_url, secret_token FROM [Webhooks]
             WHERE user_id = @userId AND event_type = @eventType AND is_active = 1`,
            { userId, eventType }
        );
        
        for (const webhook of webhooks) {
            // Webhook 배달 시도
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const signature = createHmacSignature(eventData, webhook.secret_token);
                    
                    const response = await axios.post(webhook.webhook_url, eventData, {
                        headers: {
                            'X-Webhook-Signature': signature,
                            'Content-Type': 'application/json'
                        },
                        timeout: 5000
                    });
                    
                    // 로그 기록
                    await executeNonQuery(
                        `INSERT INTO [WebhookLogs]
                         (webhook_id, event_type, event_data, status_code, response_body, attempt_number)
                         VALUES (@webhookId, @eventType, @eventData, @statusCode, @response, @attempt)`,
                        {
                            webhookId: webhook.id,
                            eventType,
                            eventData: JSON.stringify(eventData),
                            statusCode: response.status,
                            response: JSON.stringify(response.data),
                            attempt
                        }
                    );
                    
                    break; // 성공하면 루프 종료
                } catch (err) {
                    console.error(`Webhook delivery failed (attempt ${attempt}):`, err.message);
                    
                    // 실패 로그 기록
                    await executeNonQuery(
                        `INSERT INTO [WebhookLogs]
                         (webhook_id, event_type, event_data, status_code, error_message, attempt_number)
                         VALUES (@webhookId, @eventType, @eventData, @statusCode, @error, @attempt)`,
                        {
                            webhookId: webhook.id,
                            eventType,
                            eventData: JSON.stringify(eventData),
                            statusCode: 0,
                            error: err.message,
                            attempt
                        }
                    );
                    
                    if (attempt === 3) {
                        console.error(`Webhook delivery failed after 3 attempts`);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Webhook trigger error:', err);
    }
}

module.exports = {
    registerWebhook,
    getUserWebhooks,
    triggerWebhook
};