function errorHandler(err, req, res, next) {
    console.error('Error:', err);
    
    // 데이터베이스 에러
    if (err.name === 'ConnectionError') {
        return res.status(503).json({
            success: false,
            message: '데이터베이스 연결 실패',
            errorCode: 'DB_CONNECTION_ERROR'
        });
    }
    
    // 검증 에러
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: '입력값 검증 실패',
            details: err.message
        });
    }
    
    // 기본 에러
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || '서버 오류가 발생했습니다',
        errorCode: err.errorCode || 'INTERNAL_ERROR'
    });
}

module.exports = errorHandler;