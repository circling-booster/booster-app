/**
 * config/database.js
 * 역할: Azure SQL Server 연결 관리 및 쿼리 실행
 * 특징: 연결 풀링, 자동 재연결, 파라미터 바인딩
 */

const mssql = require('mssql');

/**
 * SQL Server 연결 설정
 * 
 * 환경 변수 (.env)에서 읽음:
 * - DB_SERVER: booster-sqlserver.database.windows.net
 * - DB_DATABASE: booster_db
 * - DB_USER: booster_admin
 * - DB_PASSWORD: ***
 * - DB_ENCRYPTION: true (SSL/TLS 암호화)
 * - DB_TRUST_CERTIFICATE: true (Azure의 자체 서명 인증서 허용)
 */
const sqlConfig = {
    // Azure SQL Server 주소
    server: process.env.DB_SERVER,
    // 데이터베이스명
    database: process.env.DB_DATABASE,
    // 사용자명
    user: process.env.DB_USER,
    // 비밀번호
    password: process.env.DB_PASSWORD,

    // 보안 설정
    encrypt: process.env.DB_ENCRYPTION === 'true',  // SSL/TLS 암호화
    trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === 'true', // 자체 서명 인증서 허용

    // 연결 타임아웃 (밀리초)
    connectionTimeout: 30000,
    // 요청 타임아웃 (밀리초)
    requestTimeout: 30000,

    /**
     * 연결 풀 설정
     * 동시 다중 요청을 처리하기 위해 연결 여러 개를 미리 생성
     * 
     * min: 최소 2개 연결 유지
     * max: 최대 10개 연결 (동시 요청 10개까지 처리)
     * idleTimeoutMillis: 연결 미사용 시 30초 후 종료
     */
    pool: {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000
    },

    // 인증 방식 (기본 사용자명/비밀번호)
    authentication: {
        type: 'default'
    },
    options: {
        encrypt: true,
        trustServerCertificate: true,
        camelCaseColumns: true,  // ✅ 추가: snake_case → camelCase 자동 변환
        requestTimeout: 30000
    }
};

/**
 * 전역 연결 풀 변수
 * 한 번 초기화되면 재사용됨
 */
let pool = null;

/**
 * 데이터베이스 연결 풀 초기화
 * 
 * 호출 시기: 서버 시작 시 (server.js의 startServer())
 * 목적: SQL Server와의 연결 풀 생성 및 연결 테스트
 * 
 * @returns {Promise<ConnectionPool>} 생성된 연결 풀
 * @throws {Error} 연결 실패 시 에러 발생
 * 
 * 흐름:
 * 1. ConnectionPool 객체 생성
 * 2. pool.connect() 호출 (실제 연결)
 * 3. 연결 풀 에러 리스너 설정
 * 4. 성공 로그 출력 및 반환
 */
async function initializePool() {
    try {
        // ConnectionPool 객체 생성
        pool = new mssql.ConnectionPool(sqlConfig);

        // SQL Server에 연결 시도
        await pool.connect();
        console.log('✅ 데이터베이스 연결 성공');

        // 연결 풀 에러 발생 시 처리
        // (연결 끊김, 네트워크 오류 등)
        pool.on('error', err => {
            console.error('데이터베이스 풀 에러:', err);
            // 운영 환경에서는 모니터링 시스템에 알림 전송
        });

        return pool;
    } catch (err) {
        console.error('❌ 데이터베이스 연결 실패:', err);
        throw err;
    }
}

/**
 * 데이터베이스 연결 풀 조회
 * 
 * 연결이 없으면 자동 초기화
 * 
 * @returns {Promise<ConnectionPool>} 연결 풀 객체
 * @throws {Error} 초기화 실패 시
 */
async function getPool() {
    if (!pool) {
        await initializePool();
    }
    return pool;
}

/**
 * SELECT 쿼리 실행 (데이터 조회)
 * 
 * 주요 특징:
 * - 파라미터 바인딩으로 SQL Injection 방지
 * - 결과셋 배열 반환
 * - 자동 재연결
 * 
 * @param {string} query - SQL 쿼리 (파라미터는 @name 형식)
 * @param {Object} params - 파라미터 객체 ({ name: value, ... })
 * @returns {Promise<Array>} 쿼리 결과 배열
 * @throws {Error} 쿼리 실행 실패
 * 
 * 예시:
 * const users = await executeQuery(
 *   'SELECT * FROM Users WHERE email = @email',
 *   { email: 'test@example.com' }
 * );
 */
async function executeQuery(query, params = {}) {
    try {
        // 연결 풀 획득
        const pool = await getPool();

        // 새 요청 객체 생성
        const request = pool.request();

        // 파라미터 바인딩
        // @name 형식의 파라미터를 실제 값으로 대체
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }

        // 쿼리 실행 및 결과 반환
        const result = await request.query(query);
        return result.recordset; // 결과 배열 반환
    } catch (err) {
        // 네트워크 에러 처리
        if (err.code === 'ESOCKET') {
            const customErr = new Error('데이터베이스 연결 실패');
            customErr.statusCode = 503;
            throw customErr;
        }
        // SQL 문법 에러 처리
        if (err.code === 'ER_PARSE_ERROR') {
            const customErr = new Error('쿼리 문법 오류');
            customErr.statusCode = 500;
            throw customErr;
        }
        throw err;
    }
}

/**
 * INSERT/UPDATE/DELETE 쿼리 실행 (데이터 변경)
 * 
 * 주요 특징:
 * - 결과값 반환 안 함 (void)
 * - 파라미터 바인딩으로 SQL Injection 방지
 * - 자동 재연결
 * 
 * @param {string} query - SQL 쿼리 (파라미터는 @name 형식)
 * @param {Object} params - 파라미터 객체
 * @returns {Promise<void>}
 * @throws {Error} 쿼리 실행 실패
 * 
 * 예시:
 * await executeNonQuery(
 *   'INSERT INTO Users (email, password_hash) VALUES (@email, @passwordHash)',
 *   { email: 'new@example.com', passwordHash: 'hashed_password' }
 * );
 */
async function executeNonQuery(query, params = {}) {
    try {
        // 연결 풀 획득
        const pool = await getPool();

        // 새 요청 객체 생성
        const request = pool.request();

        // 파라미터 바인딩
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }

        // 쿼리 실행 (결과값 사용 안 함)
        await request.query(query);
    } catch (err) {
        console.error('Non-Query 실행 에러:', err);
        throw err;
    }
}

/**
 * 데이터베이스 연결 풀 종료
 * 
 * 호출 시기: 애플리케이션 종료 시
 * 목적: 모든 연결 정리 및 리소스 해제
 * 
 * @returns {Promise<void>}
 */
async function closePool() {
    if (pool) {
        await pool.close();
        console.log('데이터베이스 연결 종료');
    }
}

/**
 * 모듈 내보내기
 * 
 * 다른 파일에서 사용:
 * const { executeQuery, executeNonQuery } = require('../config/database');
 */
module.exports = {
    initializePool,    // 초기화
    getPool,           // 풀 조회
    executeQuery,      // SELECT 실행
    executeNonQuery,   // INSERT/UPDATE/DELETE 실행
    closePool          // 종료
};

/**
 * ⚠️ 주의사항
 * 
 * 1. 파라미터 바인딩 필수
 *    ❌ 나쁜 예: `SELECT * FROM Users WHERE email = '${email}'`
 *    ✅ 좋은 예: `SELECT * FROM Users WHERE email = @email` + params: { email }
 * 
 * 2. 연결 풀 크기 조정
 *    - 최대 동시 요청 10개 제한
 *    - 더 필요하면 max값 증가 권장
 * 
 * 3. 타임아웃 설정
 *    - 30초 내에 응답 없으면 에러
 *    - 장시간 쿼리는 타임아웃 예상
 * 
 * 4. 에러 처리
 *    - 모든 executeQuery/executeNonQuery는 try-catch로 감싸기
 *    - 에러 메시지 로깅 필수
 */