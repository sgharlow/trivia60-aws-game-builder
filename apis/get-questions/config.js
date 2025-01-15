require('dotenv').config();

const config = {
    database: {
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        host: process.env.POSTGRES_HOST,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_NAME,
        max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '30'),
        min: parseInt(process.env.POSTGRES_MIN_CONNECTIONS || '5'),
        idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '5000'),
        statement_timeout: parseInt(process.env.POSTGRES_STATEMENT_TIMEOUT || '10000'),
        query_timeout: parseInt(process.env.POSTGRES_QUERY_TIMEOUT || '15000'),
        application_name: 'trivia_api',
        keepalive: true,
        keepaliveInitialDelayMillis: 10000,
        allowExitOnIdle: true,
        connectionRetryDelay: 1000,
        maxRetries: 3
    },
    server: {
        maxRequestQueue: parseInt(process.env.MAX_REQUEST_QUEUE || '500'),
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '15000'),
        port: parseInt(process.env.PORT || '3000'),
        allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*']
    },
    rateLimiting: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
        max: parseInt(process.env.RATE_LIMIT_MAX || '100')
    },
    monitoring: {
        poolCheckInterval: parseInt(process.env.POOL_CHECK_INTERVAL || '5000'),
        poolMetricsInterval: parseInt(process.env.POOL_METRICS_INTERVAL || '30000'),
        poolWarningThreshold: parseFloat(process.env.POOL_WARNING_THRESHOLD || '0.8')
    }
};

module.exports = config;
