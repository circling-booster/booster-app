/**
 * controllers/processImageValidateController.js - OpenAI 통합 버전
 * 역할: 이미지 처리, API Key 검증, OpenAI 분석 요청 처리
 * 특징: 이미지 분석 결과를 텍스트로 반환
 */

const processImageValidateService = require('../services/processImageValidateService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');

/**
 * 이미지 처리 및 OpenAI 분석 핸들러
 * 
 * @route POST /api/process-image-validate
 * @public (인증 불필요)
 * @param {string} api_key - API Key (sk_... 형식)
 * @param {string} api_secret - API Secret
 * @param {string} image - Base64 인코딩된 이미지
 * @param {string} [prompt] - 이미지 분석 프롬프트 (옵션)
 * 
 * @returns {200} 검증 및 분석 성공
 * {
 *   success: true,
 *   data: {
 *     user_id: string,
 *     api_key_id: string,
 *     creation_date: datetime,
 *     expiration_date: datetime,
 *     is_active: boolean,
 *     image_length: number,
 *     text: string  ← OpenAI 분석 결과
 *   },
 *   message: "이미지 분석 성공"
 * }
 */
async function processImageValidate(req, res) {
  const startTime = Date.now();

  try {
    // 1. 요청 바디에서 필수 정보 추출
    const { api_key, api_secret, prompt } = req.body;

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

    // 6. Service 호출: API Key/Secret 검증
    const result = await processImageValidateService.validateApiKey(api_key, api_secret);

    // 7. 검증 실패 처리
    if (!result.success) {
      const responseTime = Date.now() - startTime;

      await processImageValidateService.logImageValidationAttempt({
        api_key_id: null,
        user_id: null,
        endpoint: '/api/process-image-validate',
        method: 'POST',
        status_code: result.statusCode || 401,
        response_time_ms: responseTime,
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
    let openaiError = null;

    try {
      // OpenAI API를 호출하여 이미지 분석
      analysisText = await processImageValidateService.analyzeImageWithOpenAI(
        base64Image,
        prompt
      );
      
      console.log('[IMAGE_ANALYSIS_SUCCESS]', {
        userId: result.user_id,
        textLength: analysisText.length
      });
    } catch (openaiErr) {
      // OpenAI 호출 실패 - 에러 로깅하지만 계속 진행
      console.error('[OPENAI_ANALYSIS_FAILED]', openaiErr.message);
      openaiError = openaiErr.message;
      
      // 분석 실패는 응답에 포함하되, 기본 검증 응답은 유지
      analysisText = `[이미지 분석 실패: ${openaiError}]`;
    }

    // 9. 응답 시간 계산
    const responseTime = Date.now() - startTime;

    // 10. 성공 로깅
    await processImageValidateService.logImageValidationAttempt({
      api_key_id: result.api_key_id,
      user_id: result.user_id,
      endpoint: '/api/process-image-validate',
      method: 'POST',
      status_code: 200,
      response_time_ms: responseTime,
      ip_address: req.ip,
      request_body: JSON.stringify({
        api_key: api_key.substring(0, 10) + '...',
        hasPrompt: !!prompt
      }),
      error_message: null
    }).catch(logErr => {
      console.error('[LOGGING_ERROR]', logErr.message);
    });

    // 11. 성공 응답 - OpenAI 분석 결과 포함
    successResponse(
      res,
      {
        user_id: result.user_id,
        api_key_id: result.api_key_id,
        creation_date: result.created_at,
        expiration_date: result.expires_at,
        is_active: !!result.is_active,
        image_length: imageLength,
        text: analysisText  // ← OpenAI 이미지 분석 결과
      },
      '이미지 분석 성공',
      200
    );

  } catch (err) {
    // 예상치 못한 에러 처리
    const responseTime = Date.now() - startTime;

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
      response_time_ms: responseTime,
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
 * 모듈 내보내기
 */
module.exports = {
  processImageValidate
};