function errorResponse(res, message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    res.status(statusCode).json({
        success: false,
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString()
    });
}

module.exports = errorResponse;