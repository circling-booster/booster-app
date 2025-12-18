class Subscription {
    static FIELDS = {
        id: 'id',
        userId: 'user_id',
        tierId: 'tier_id',
        status: 'status',
        startDate: 'start_date',
        endDate: 'end_date',
        approvalDate: 'approval_date',
        approvedBy: 'approved_by',
        rejectionReason: 'rejection_reason',
        autoRenewal: 'auto_renewal',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    };

    static TABLE = 'UserSubscriptions';
}

module.exports = Subscription;