// Global log buffer to capture console output
global.logBuffer = [];
const MAX_LOG_BUFFER = 500;

// Intercept console.log
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] [INFO] ${args.join(' ')}`;
    global.logBuffer.push(message);
    if (global.logBuffer.length > MAX_LOG_BUFFER) global.logBuffer.shift();
    originalLog.apply(console, args);
};

console.error = function (...args) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] [ERROR] ${args.join(' ')}`;
    global.logBuffer.push(message);
    if (global.logBuffer.length > MAX_LOG_BUFFER) global.logBuffer.shift();
    originalError.apply(console, args);
};

module.exports = { logBuffer: global.logBuffer };
