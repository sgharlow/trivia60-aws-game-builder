// Logger service for consistent logging across the application
class LoggerService {
    constructor() {
        this.logLevel = 'debug'; // Set to 'debug' to show all logs
    }

    debug(message, ...args) {
        if (this.logLevel === 'debug') {
            console.log(`[${new Date().toISOString()}] [DEBUG] ${message}`, ...args);
        }
    }

    info(message, ...args) {
        console.log(`[${new Date().toISOString()}] [INFO] ${message}`, ...args);
    }

    warn(message, ...args) {
        console.warn(`[${new Date().toISOString()}] [WARN] ${message}`, ...args);
    }

    error(message, ...args) {
        console.error(`[${new Date().toISOString()}] [ERROR] ${message}`, ...args);
    }
}

const logger = new LoggerService();
export default logger;
