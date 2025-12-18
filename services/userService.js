const { executeQuery, executeNonQuery } = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/cryptoUtils');

async function getUserInfo(userId) {
    try {
        const users = await executeQuery(
            `SELECT id, first_name, last_name, email, phone_number, is_admin, is_active, is_blocked, created_at 
             FROM [Users] WHERE id = @userId`,
            { userId }
        );

        if (users.length === 0) {
            throw new Error('사용자를 찾을 수 없습니다');
        }

        console.log(users)

        return users;
    } catch (err) {
        throw err;
    }
}

async function updateUserProfile(userId, updateData) {
    try {
        let updateQuery = 'UPDATE [Users] SET ';
        const params = { userId };
        const updates = [];

        if (updateData.firstName) {
            updates.push('first_name = @firstName');
            params.firstName = updateData.firstName;
        }

        if (updateData.lastName) {
            updates.push('last_name = @lastName');
            params.lastName = updateData.lastName;
        }

        if (updateData.phoneNumber) {
            updates.push('phone_number = @phoneNumber');
            params.phoneNumber = updateData.phoneNumber;
        }

        if (updateData.email) {
            updates.push('email = @email');
            params.email = updateData.email;
        }

        if (updates.length === 0) {
            throw new Error('업데이트할 정보가 없습니다');
        }

        updates.push('updated_at = GETDATE()');
        updateQuery += updates.join(', ') + ' WHERE id = @userId';

        await executeNonQuery(updateQuery, params);

        return await getUserInfo(userId);
    } catch (err) {
        throw err;
    }
}
async function changePassword(userId, currentPassword, newPassword) {
    try {
        // Step 1: 사용자 조회
        const users = await executeQuery(
            'SELECT password_hash FROM [Users] WHERE id = @userId',
            { userId }
        );

        if (!users || users.length === 0) {
            throw new Error('사용자를 찾을 수 없습니다');
        }

        const user = users[0];

        // Step 2: ✅ 기존 비밀번호 검증 (보안)
        const { verifyPassword } = require('../utils/cryptoUtils');
        const isValid = await verifyPassword(currentPassword, user.password_hash);

        if (!isValid) {
            const error = new Error('현재 비밀번호가 일치하지 않습니다');
            error.statusCode = 403;
            throw error;
        }

        // Step 3: 새 비밀번호 해싱
        const { hashPassword } = require('../utils/cryptoUtils');
        const newHash = await hashPassword(newPassword);

        // Step 4: 데이터베이스 업데이트
        await executeNonQuery(
            'UPDATE [Users] SET password_hash = @passwordHash, updated_at = GETDATE() WHERE id = @userId',
            {
                userId,
                passwordHash: newHash
            }
        );

        console.log('[비밀번호 변경]', {
            userId,
            timestamp: new Date().toISOString()
        });

        return { success: true };
    } catch (err) {
        throw err;
    }
}


module.exports = {
    getUserInfo,
    updateUserProfile,
    changePassword
};