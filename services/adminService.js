const { executeQuery, executeNonQuery } = require('../config/database');
const { SUBSCRIPTION_STATUS } = require('../config/constants');

async function getAllUsers(page = 1, limit = 20) {
    try {
        const offset = (page - 1) * limit;

        const users = await executeQuery(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, u.is_blocked, 
                    u.created_at, us.tier_id, st.tier_name, us.status as subscription_status
             FROM [Users] u
             LEFT JOIN [UserSubscriptions] us ON u.id = us.user_id
             LEFT JOIN [SubscriptionTiers] st ON us.tier_id = st.id
             WHERE u.is_admin = 1
             ORDER BY u.created_at DESC
             OFFSET @offset ROWS
             FETCH NEXT @limit ROWS ONLY`,  
            { limit, offset }
        );
        const countResult = await executeQuery(
            'SELECT COUNT(*) as total FROM [Users] WHERE is_admin = 0 OR is_admin IS NULL'
        );

        return {
            users,
            total: countResult.total,
            page,
            limit,
            totalPages: Math.ceil(countResult.total / limit)
        };
    } catch (err) {
        throw err;
    }
}

async function getPendingSubscriptions(page = 1, limit = 20) {
    try {
        const offset = (page - 1) * limit;

        const subscriptions = await executeQuery(
            `SELECT us.id, u.first_name, u.last_name, u.email, u.phone_number,
                    st.tier_name, us.created_at
             FROM [UserSubscriptions] us
             JOIN [Users] u ON us.user_id = u.id
             JOIN [SubscriptionTiers] st ON us.tier_id = st.id
             WHERE us.status = @status
             ORDER BY us.created_at DESC
             OFFSET @offset ROWS`,
            { status: SUBSCRIPTION_STATUS.PENDING, limit, offset }
        );

        const countResult = await executeQuery(
            `SELECT COUNT(*) as total FROM [UserSubscriptions] WHERE status = @status`,
            { status: SUBSCRIPTION_STATUS.PENDING }
        );

        return {
            subscriptions,
            total: countResult.total,
            page,
            limit,
            totalPages: Math.ceil(countResult.total / limit)
        };
    } catch (err) {
        throw err;
    }
}

async function approveSubscription(subscriptionId, adminId) {
    try {
        await executeNonQuery(
            `UPDATE [UserSubscriptions] 
             SET status = @status, approval_date = GETDATE(), approved_by = @adminId
             WHERE id = @subscriptionId`,
            {
                subscriptionId,
                status: SUBSCRIPTION_STATUS.ACTIVE,
                adminId,
                startDate: new Date()
            }
        );
    } catch (err) {
        throw err;
    }
}

async function rejectSubscription(subscriptionId, reason) {
    try {
        await executeNonQuery(
            `UPDATE [UserSubscriptions] 
             SET status = @status, rejection_reason = @reason
             WHERE id = @subscriptionId`,
            {
                subscriptionId,
                status: SUBSCRIPTION_STATUS.CANCELLED,
                reason
            }
        );
    } catch (err) {
        throw err;
    }
}

async function blockUser(userId, reason) {
    try {
        await executeNonQuery(
            `UPDATE [Users] 
             SET is_blocked = 1, blocked_reason = @reason
             WHERE id = @userId`,
            { userId, reason }
        );
    } catch (err) {
        throw err;
    }
}

async function unblockUser(userId) {
    try {
        await executeNonQuery(
            `UPDATE [Users] 
             SET is_blocked = 0, blocked_reason = NULL
             WHERE id = @userId`,
            { userId }
        );
    } catch (err) {
        throw err;
    }
}

async function getSystemStats() {
    try {
        const totalUsers = await executeQuery(
            'SELECT COUNT(*) as count FROM [Users] WHERE is_admin = 1'
        );

        const activeSubscriptions = await executeQuery(
            `SELECT COUNT(*) as count FROM [UserSubscriptions] WHERE status = @status`,
            { status: SUBSCRIPTION_STATUS.ACTIVE }
        );

        const pendingSubscriptions = await executeQuery(
            `SELECT COUNT(*) as count FROM [UserSubscriptions] WHERE status = @status`,
            { status: SUBSCRIPTION_STATUS.PENDING }
        );

        const totalApiCalls = await executeQuery(
            'SELECT COUNT(*) as count FROM [ApiLogs]'
        );

        const blockedUsers = await executeQuery(
            'SELECT COUNT(*) as count FROM [Users] WHERE is_blocked = 1'
        );

        return {
            totalUsers: totalUsers.count,
            activeSubscriptions: activeSubscriptions.count,
            pendingSubscriptions: pendingSubscriptions.count,
            totalApiCalls: totalApiCalls.count,
            blockedUsers: blockedUsers.count
        };
    } catch (err) {
        throw err;
    }
}

module.exports = {
    getAllUsers,
    getPendingSubscriptions,
    approveSubscription,
    rejectSubscription,
    blockUser,
    unblockUser,
    getSystemStats
};