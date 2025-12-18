/**
 * ApiKey 모델
 * API 인증 키 정보를 관리하는 데이터 모델
 * 역할: API Key/Secret 저장소 스키마 정의
 */

class ApiKey {
    // ========== 데이터베이스 필드 매핑 ==========
    static FIELDS = {
        id: 'id',                          // API Key 고유 ID (UUID)
        userId: 'user_id',                 // 소유자 사용자 ID
        keyName: 'key_name',               // API Key 이름 (사용자가 지정, e.g., "Production Key")
        apiKey: 'api_key',                 // 실제 API Key (sk_로 시작하는 48자 문자열)
        apiSecretHash: 'api_secret_hash',  // API Secret의 SHA256 해시
        isActive: 'is_active',             // 활성화 상태 (0: 비활성화, 1: 활성화)
        lastUsed: 'last_used',             // 마지막 사용 시간
        ipWhitelist: 'ip_whitelist',       // IP 화이트리스트 (콤마로 구분)
        createdAt: 'created_at',           // 생성 일시
        expiresAt: 'expires_at'            // 만료 일시
    };

    // SQL 테이블명
    static TABLE = 'ApiKeys';
}

module.exports = ApiKey;