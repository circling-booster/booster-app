const { executeQuery, executeNonQuery } = require('../config/database');
const { SUBSCRIPTION_STATUS, API_CALL_LIMITS } = require('../config/constants');

async function requestSubscription(userId, tierId) {
    try {
        // 기존 활성 구독 확인
        const activeSubscriptions = await executeQuery(
            `SELECT id FROM [UserSubscriptions] 
             WHERE user_id = @userId AND status = @status`,
            { userId, status: SUBSCRIPTION_STATUS.ACTIVE }
        );

        if (activeSubscriptions.length > 0) {
            throw new Error('이미 활성화된 구독이 있습니다');
        }
        const tier = await executeQuery(
            `SELECT id FROM [SubscriptionTiers]
             WHERE id = @tierId AND is_active = 1`,
            { tierId }
        );
        if (tier.length === 0) {
            throw new Error('유효하지 않은 구독 Tier입니다');
        }
        const subscriptionId = require('crypto').randomUUID();

        // 구독 신청 생성
        await executeNonQuery(
            `INSERT INTO [UserSubscriptions] 
             (id, user_id, tier_id, status)
             VALUES (@id, @userId, @tierId, @status)`,
            {
                id: subscriptionId,
                userId,
                tierId,
                status: SUBSCRIPTION_STATUS.PENDING
            }
        );

        return subscriptionId;
    } catch (err) {
        throw err;
    }
}

async function getUserSubscription(userId) {
    try {
        const subscriptions = await executeQuery(
            `SELECT us.id, us.user_id, us.tier_id, us.status, us.start_date, us.end_date, 
                    st.tier_name, st.api_call_limit
             FROM [UserSubscriptions] us
             LEFT JOIN [SubscriptionTiers] st ON us.tier_id = st.id
             WHERE us.user_id = @userId
             ORDER BY us.created_at DESC`,
            { userId }
        );

        if (subscriptions.length === 0) {
            return null;
        }

        return subscriptions[0];
    } catch (err) {
        throw err;
    }
}

async function isSubscriptionActive(userId) {
    try {
        const subscription = await getUserSubscription(userId);

        if (!subscription) return false;

        // 상태가 active이고 만료일이 지나지 않았는지 확인
        if (subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
            return false;
        }

        if (subscription.end_date && new Date(subscription.end_date) < new Date()) {
            return false;
        }

        return true;
    } catch (err) {
        throw err;
    }
}

async function getSubscriptionTiers() {
    try {
        const tiers = await executeQuery(
            `SELECT id, tier_name, api_call_limit, price, description 
             FROM [SubscriptionTiers]
             WHERE is_active = 1`
        );

        return tiers;
    } catch (err) {
        throw err;
    }
}

module.exports = {
    requestSubscription,
    getUserSubscription,
    isSubscriptionActive,
    getSubscriptionTiers
};