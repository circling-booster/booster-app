const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');

// logs 디렉토리 생성
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function formatLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    return {
        timestamp,
        level,
        message,
        data,
        stack: new Error().stack
    };
}

function log(message, data = null) {
    const logEntry = formatLog('INFO', message, data);
    console.log(`[INFO] ${message}`, data || '');
}

function error(message, err = null) {
    const logEntry = formatLog('ERROR', message, err);
    console.error(`[ERROR] ${message}`, err || '');

    // 수정: 날짜 부분만 추출
    const dateStr = new Date().toISOString().split('T')[0];  // '2025-12-17'
    const logFile = path.join(logsDir, `error-${dateStr}.log`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
}

function warn(message, data = null) {
    const logEntry = formatLog('WARN', message, data);
    console.warn(`[WARN] ${message}`, data || '');
}

module.exports = {
    log,
    error,
    warn
};