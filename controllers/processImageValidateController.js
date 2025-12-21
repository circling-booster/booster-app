/**
* controllers/processImageValidateController.js - OpenAI 통합 버전 (DB 수정 없음)
* 역할: 이미지 처리, API Key 검증, OpenAI 분석 요청 처리
* 특징: 시간 측정 및 응답에 포함 (DB 스키마 변경 없음)
*/

const processImageValidateService = require('../services/processImageValidateService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');

/**
* ✅ 수정: 이미지 처리 및 OpenAI 분석 핸들러 (시간 측정 포함)
*
* @route POST /api/process-image-validate
* @public (인증 불필요)
* @param {string} api_key - API Key
* @param {string} api_secret - API Secret
* @param {string} image - Base64 인코딩된 이미지
* @param {string} url - 
* @param {string} [prompt] - 이미지 분석 프롬프트 (옵션)
*
* @returns {200} 성공 응답 (시간 정보 포함)
*
* 주요 변경:
* - requestStartTime 기록 (전체 시간 측정)
* - OpenAI 응답 시간 추출
* - 시간 계산 로직 추가
* - timing 객체 응답에 포함
*/

async function processImageValidate(req, res) {
  // ✅ 추가: 요청 시간 시작점 기록
  const requestStartTime = Date.now();

  try {
    // 1. 요청 바디에서 필수 정보 추출
    const { api_key, api_secret, prompt, url } = req.body;

    // 2. 필수값 검증
    if (!api_key || !api_secret) {
      return errorResponse(
        res,
        'API Key 또는 Secret이 누락되었습니다',
        400,
        'MISSING_CREDENTIALS'
      );
    }

    // 3. API Key 형식 검증
    if (!api_key.startsWith('sk_')) {
      return errorResponse(
        res,
        '유효하지 않은 API Key 형식입니다',
        400,
        'INVALID_API_KEY_FORMAT'
      );
    }

    // 4. 미들웨어에서 검증된 base64 이미지 가져오기
    const base64Image = req.base64Image;
    if (!base64Image) {
      return errorResponse(
        res,
        '이미지 처리 중 오류가 발생했습니다',
        500,
        'IMAGE_PROCESSING_ERROR'
      );
    }

    // 5. 이미지 길이 계산
    const imageLength = base64Image.length;

    // ✅ 추가: 서버 처리 시간 측정 시작 (API Key 검증 전)
    const serverProcessingStartTime = Date.now();

    // 6. Service 호출: API Key/Secret 검증
    const result = await processImageValidateService.validateApiKey(api_key, api_secret);

    // 7. 검증 실패 처리
    if (!result.success) {
      const totalResponseTime = Date.now() - requestStartTime;
      const serverProcessingTime = Date.now() - serverProcessingStartTime;

      await processImageValidateService.logImageValidationAttempt({
        api_key_id: null,
        user_id: null,
        endpoint: '/api/process-image-validate',
        method: 'POST',
        status_code: result.statusCode || 401,
        response_time_ms: totalResponseTime,
        openai_response_time_ms: 0,
        server_processing_time_ms: serverProcessingTime,
        ip_address: req.ip,
        request_body: JSON.stringify({
          api_key: api_key.substring(0, 10) + '...'
        }),
        error_message: result.error
      }).catch(logErr => {
        console.error('[LOGGING_ERROR]', logErr.message);
      });

      return errorResponse(
        res,
        result.error,
        result.statusCode || 401,
        result.errorCode || 'INVALID_API_KEY'
      );
    }

    // 8. API Key 검증 성공 - OpenAI 이미지 분석 호출
    let analysisText = null;
    let openaiResponseTime = 0;
    let openaiError = null;
    
    

    try {
      // ✅ 수정: OpenAI 호출 (시간 측정 결과 포함)
      const openaiResult = await processImageValidateService.analyzeImageWithOpenAI(
        base64Image,
        prompt,
        url
      );

      analysisText = openaiResult.answer;
      openaiResponseTime = openaiResult.openaiResponseTimeMs;

      console.log('[IMAGE_ANALYSIS_SUCCESS]', {
        userId: result.user_id,
        textLength: analysisText.length,
        openaiResponseTimeMs: openaiResponseTime
      });

    } catch (openaiErr) {
      // OpenAI 호출 실패 - 에러 로깅하지만 계속 진행
      console.error('[OPENAI_ANALYSIS_FAILED]', openaiErr.message);
      openaiError = openaiErr.message;
      analysisText = `[이미지 분석 실패: ${openaiError}]`;
      // OpenAI 응답 시간은 0으로 설정 (실패한 경우)
      openaiResponseTime = 0;
    }

    // ✅ 추가: 총 응답 시간과 서버 처리 시간 계산
    const totalResponseTime = Date.now() - requestStartTime;
    const serverProcessingTime = totalResponseTime - openaiResponseTime;

    // 9. 성공 로깅 (시간 정보 포함 - 메모리 저장소에만 저장)
    await processImageValidateService.logImageValidationAttempt({
      api_key_id: result.api_key_id,
      user_id: result.user_id,
      endpoint: '/api/process-image-validate',
      method: 'POST',
      status_code: 200,
      response_time_ms: totalResponseTime,
      openai_response_time_ms: openaiResponseTime,
      server_processing_time_ms: serverProcessingTime,
      ip_address: req.ip,
      request_body: JSON.stringify({
        api_key: api_key.substring(0, 10) + '...',
        hasPrompt: !!prompt
      }),
      error_message: null
    }).catch(logErr => {
      console.error('[LOGGING_ERROR]', logErr.message);
    });

    // ✅ 수정: 성공 응답 - 시간 정보 포함
    successResponse(
      res,
      {
        user_id: result.user_id,
        api_key_id: result.api_key_id,
        creation_date: result.created_at,
        expiration_date: result.expires_at,
        is_active: !!result.is_active,
        image_length: imageLength,
        text: analysisText,
        timing: {  // ✅ 추가: timing 객체
          total_time_ms: totalResponseTime,
          openai_response_time_ms: openaiResponseTime,
          server_processing_time_ms: serverProcessingTime
        }
      },
      '이미지 분석 성공',
      200
    );

  } catch (err) {
    // 예상치 못한 에러 처리
    const totalResponseTime = Date.now() - requestStartTime;

    console.error('[PROCESS_IMAGE_VALIDATE_ERROR]', {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });

    // 에러 로깅 시도
    await processImageValidateService.logImageValidationAttempt({
      api_key_id: null,
      user_id: null,
      endpoint: '/api/process-image-validate',
      method: 'POST',
      status_code: 500,
      response_time_ms: totalResponseTime,
      openai_response_time_ms: 0,
      server_processing_time_ms: totalResponseTime,
      ip_address: req.ip,
      request_body: req.body ? JSON.stringify(req.body) : null,
      error_message: err.message
    }).catch(logErr => {
      console.error('[LOGGING_ERROR]', logErr.message);
    });

    // 서버 에러 응답
    errorResponse(
      res,
      '서버 오류가 발생했습니다',
      500,
      'INTERNAL_ERROR'
    );
  }
}

/**
* ✅ 추가: 타이밍 로그 조회 엔드포인트 (관리자용)
* 메모리 버퍼에 저장된 최근 타이밍 정보 조회
*
* @route GET /api/admin/timing-logs
* @param {number} [limit=20] - 조회할 로그 개수
* @returns {200} 타이밍 로그 목록
*
* @example
* GET /api/admin/timing-logs?limit=50
*
* 응답:
* {
*   success: true,
*   data: {
*     total_logs: 50,
*     logs: [
*       {
*         timestamp: "2025-12-18T09:15:32.123Z",
*         log_id: "abc123...",
*         endpoint: "/api/process-image-validate",
*         total_time_ms: 2450,
*         openai_response_time_ms: 1800,
*         server_processing_time_ms: 650,
*         openai_ratio: "73.47%",
*         status_code: 200,
*         user_id: "550e8400..."
*       },
*       ...
*     ]
*   },
*   message: "타이밍 로그 조회 성공"
* }
*/

async function getTimingLogs(req, res) {
  try {
    const { limit = 20 } = req.query;
    const logs = processImageValidateService.getTimingLogs(parseInt(limit));

    successResponse(
      res,
      {
        total_logs: logs.length,
        logs
      },
      '타이밍 로그 조회 성공',
      200
    );
  } catch (err) {
    console.error('[GET_TIMING_LOGS_ERROR]', err);
    errorResponse(
      res,
      '타이밍 로그 조회 중 오류가 발생했습니다',
      500,
      'TIMING_LOGS_ERROR'
    );
  }
}

/**
* ✅ 추가: 타이밍 통계 조회 엔드포인트 (관리자용)
* 메모리 버퍼의 통계 정보 조회
*
* @route GET /api/admin/timing-statistics
* @returns {200} 타이밍 통계
*
* @example
* GET /api/admin/timing-statistics
*
* 응답:
* {
*   success: true,
*   data: {
*     total_requests: 156,
*     total_time: {
*       min: 950,
*       max: 5200,
*       avg: 2340,
*       total: 156
*     },
*     openai_response_time: {
*       min: 650,
*       max: 4100,
*       avg: 1780,
*       total: 156
*     },
*     server_processing_time: {
*       min: 150,
*       max: 1200,
*       avg: 560,
*       total: 156
*     },
*     avg_openai_ratio: "76.07%"
*   },
*   message: "타이밍 통계 조회 성공"
* }
*/

async function getTimingStatistics(req, res) {
  try {
    const stats = processImageValidateService.getTimingStatistics();

    successResponse(
      res,
      stats,
      '타이밍 통계 조회 성공',
      200
    );
  } catch (err) {
    console.error('[GET_TIMING_STATISTICS_ERROR]', err);
    errorResponse(
      res,
      '타이밍 통계 조회 중 오류가 발생했습니다',
      500,
      'TIMING_STATISTICS_ERROR'
    );
  }
}

/**
* ✅ 수정: 모듈 내보내기 (새로운 함수 추가)
*/

module.exports = {
  processImageValidate,
  getTimingLogs,  // ✅ 추가
  getTimingStatistics  // ✅ 추가
};
