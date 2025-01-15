const DEFAULT_OPTIONS = {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    onRetry: null
};

/**
 * Implements exponential backoff with jitter for API retries
 * @param {Function} operation - The async operation to retry
 * @param {Object} options - Retry configuration options
 * @returns {Promise} - The result of the operation
 */
async function withRetry(operation, options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    let lastError = null;
    let attempt = 0;

    while (attempt < config.maxRetries) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            // Check if we should retry based on the error
            if (!error.statusCode || !config.retryableStatusCodes.includes(error.statusCode)) {
                throw error;
            }

            attempt++;
            if (attempt === config.maxRetries) {
                break;
            }

            // Calculate delay with exponential backoff and jitter
            const exponentialDelay = Math.min(
                config.initialDelay * Math.pow(config.backoffFactor, attempt - 1),
                config.maxDelay
            );
            const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
            const delay = exponentialDelay + jitter;

            // Call onRetry callback if provided
            if (config.onRetry) {
                config.onRetry({
                    error,
                    attempt,
                    delay,
                    willRetry: attempt < config.maxRetries
                });
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

module.exports = {
    withRetry,
    DEFAULT_OPTIONS
};
