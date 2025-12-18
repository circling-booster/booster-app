/**
 * User 모델
 * 데이터베이스 Users 테이블의 필드를 정의하고 SQL 쿼리 헬퍼 메서드를 제공
 * 역할: 사용자 정보의 스키마 정의 및 쿼리 생성
 */

class User {
    // ========== 데이터베이스 필드 매핑 ==========
    // JavaScript 필드명 -> SQL 컬럼명 매핑
    static FIELDS = {
        id: 'id',                          // 사용자 고유 ID (UUID)
        firstName: 'first_name',           // 이름
        lastName: 'last_name',             // 성
        email: 'email',                    // 이메일 (유니크)
        phoneNumber: 'phone_number',       // 휴대폰 번호
        passwordHash: 'password_hash',     // bcrypt 해싱된 비밀번호
        isAdmin: 'is_admin',               // 관리자 여부 (0 또는 1)
        isActive: 'is_active',             // 활성화 상태 (0 또는 1)
        isBlocked: 'is_blocked',           // 차단 상태 (0 또는 1)
        blockedReason: 'blocked_reason',   // 차단 사유
        createdAt: 'created_at',           // 생성일시
        updatedAt: 'updated_at',           // 수정일시
        lastLogin: 'last_login'            // 마지막 로그인 일시
    };

    // SQL 테이블명
    static TABLE = 'Users';

    /**
     * SELECT 쿼리 생성 헬퍼
     * @param {string} where - WHERE 조건 (optional)
     * @returns {string} SQL SELECT 쿼리
     * @example
     *   User.getSelectQuery("email = @email")
     *   // SELECT * FROM [Users] WHERE email = @email
     */
    static getSelectQuery(where = '') {
        const query = `SELECT * FROM [${this.TABLE}]`;
        return where ? `${query} WHERE ${where}` : query;
    }

    /**
     * INSERT 쿼리 생성 헬퍼
     * @param {Object} data - 삽입할 데이터 객체 {firstName, lastName, email, ...}
     * @returns {string} SQL INSERT 쿼리
     * @example
     *   User.getInsertQuery({firstName: "John", lastName: "Doe", email: "john@example.com"})
     *   // INSERT INTO [Users] (first_name, last_name, email) VALUES (@firstName, @lastName, @email)
     */
    static getInsertQuery(data) {
        const fields = Object.keys(data);
        // @firstName, @lastName, @email 형태의 파라미터 생성
        const values = fields.map(f => `@${f}`).join(', ');
        // SQL 컬럼명으로 변환
        const fieldNames = fields.map(f => this.FIELDS[f] || f).join(', ');
        
        return `INSERT INTO [${this.TABLE}] (${fieldNames}) VALUES (${values})`;
    }

    /**
     * UPDATE 쿼리 생성 헬퍼
     * @param {Object} data - 수정할 데이터 {firstName, lastName, ...}
     * @param {string} whereId - WHERE 조건 (일반적으로 id = @id)
     * @returns {string} SQL UPDATE 쿼리
     * @example
     *   User.getUpdateQuery({firstName: "Jane", email: "jane@example.com"}, "id = @id")
     *   // UPDATE [Users] SET first_name = @firstName, email = @email WHERE id = @id
     */
    static getUpdateQuery(data, whereId) {
        // "first_name = @firstName, last_name = @lastName" 형태로 생성
        const updates = Object.keys(data)
            .map(key => `${this.FIELDS[key] || key} = @${key}`)
            .join(', ');
        
        return `UPDATE [${this.TABLE}] SET ${updates} WHERE id = @id`;
    }
}

module.exports = User;