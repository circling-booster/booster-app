function successResponse(res, data, message = '요청이 성공했습니다', statusCode = 200) {
    res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
}

module.exports = successResponse;