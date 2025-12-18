/**
 * middleware/imageValidationMiddleware.js
 * 역할: Base64 이미지 검증 미들웨어
 * 특징: 이미지 형식, 크기 검증
 */

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Base64 이미지 유효성 검증
 * 
 * @param {string} image - base64 인코딩된 이미지 (data:image/...;base64,... 형식)
 * @returns {boolean} 유효 여부
 * 
 * @note
 * - 형식: "data:image/png;base64,..." 또는 "data:image/jpeg;base64,..."
 * - 또는 순수 base64 문자열도 허용
 * - base64 문자열은 [A-Za-z0-9+/=] 문자만 포함
 */
function isValidBase64Image(image) {
  if (!image || typeof image !== 'string') {
    return false;
  }

  // data URL 형식인 경우
  if (image.startsWith('data:image/')) {
    try {
      const matches = image.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
      if (!matches || matches.length < 3) {
        return false;
      }
      
      const base64Data = matches[2];
      
      // base64 유효성 검사
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
        return false;
      }

      // 크기 검사 (base64는 약 33% 더 큼)
      const binarySize = Buffer.from(base64Data, 'base64').length;
      return binarySize <= MAX_IMAGE_SIZE;
    } catch (err) {
      console.error('[IMAGE_VALIDATION_ERROR]', err);
      return false;
    }
  }

  // 순수 base64 문자열인 경우
  try {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(image)) {
      return false;
    }

    const binarySize = Buffer.from(image, 'base64').length;
    return binarySize <= MAX_IMAGE_SIZE;
  } catch (err) {
    console.error('[IMAGE_VALIDATION_ERROR]', err);
    return false;
  }
}

/**
 * Base64 문자열에서 실제 이미지 데이터 추출
 * 
 * @param {string} image - base64 인코딩된 이미지
 * @returns {string} 순수 base64 문자열 (data URL 헤더 제거)
 */
function extractBase64Data(image) {
  if (image.startsWith('data:image/')) {
    // data URL 형식: "data:image/png;base64,..."에서 base64 부분만 추출
    const matches = image.match(/^data:image\/[a-z]+;base64,(.+)$/);
    return matches ? matches[1] : image;
  }
  
  return image;
}

/**
 * 이미지 검증 미들웨어
 * 
 * @middleware
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어
 * 
 * @returns {void}
 * 
 * @note
 * - image 필드가 필수입니다
 * - 유효하지 않은 이미지는 400 에러로 응답
 * - 유효한 이미지는 req.image에 순수 base64로 저장
 */
function validateImageMiddleware(req, res, next) {
  const { image } = req.body;

  // 1. 이미지 필드 존재 확인
  if (!image) {
    return res.status(400).json({
      success: false,
      message: '이미지 데이터가 누락되었습니다',
      errorCode: 'MISSING_IMAGE',
      timestamp: new Date().toISOString()
    });
  }

  // 2. Base64 이미지 형식 검증
  if (!isValidBase64Image(image)) {
    return res.status(400).json({
      success: false,
      message: '유효한 base64 이미지가 아닙니다',
      errorCode: 'INVALID_IMAGE_FORMAT',
      timestamp: new Date().toISOString()
    });
  }

  // 3. 순수 base64 데이터 추출하여 req에 저장
  try {
    req.base64Image = extractBase64Data(image);
    next();
  } catch (err) {
    console.error('[IMAGE_EXTRACTION_ERROR]', err);
    return res.status(400).json({
      success: false,
      message: '이미지 데이터 처리 중 오류가 발생했습니다',
      errorCode: 'IMAGE_PROCESSING_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 모듈 내보내기
 */
module.exports = {
  validateImageMiddleware,
  isValidBase64Image,
  extractBase64Data
};