const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cron = require('node-cron');
const { Pool } = require('pg');
const axios = require('axios');
const winston = require('winston');
const nodemailer = require('nodemailer');

// Initialize logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Initialize database pool
const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_NAME,
    port: parseInt(process.env.POSTGRES_PORT, 10)
});

// Initialize email transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Services to monitor
const services = [
    { name: 'get-questions', url: 'http://get-questions:4001/api/health' },
    { name: 'add-questions', url: 'http://add-questions:4002/api/health' },
    { name: 'leaderboard', url: 'http://leaderboard:4003/api/health' }
];

// Check health of a single service
async function checkServiceHealth(service) {
    try {
        const response = await axios.get(service.url, { timeout: 5000 });
        return {
            name: service.name,
            status: response.data.status === 'healthy' ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            details: response.data
        };
    } catch (error) {
        logger.error(`Health check failed for ${service.name}:`, error.message);
        return {
            name: service.name,
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        };
    }
}

// Store health check result in database
async function storeHealthCheck(result) {
    try {
        await pool.query(
            'INSERT INTO health_checks (service_name, status, details, checked_at) VALUES ($1, $2, $3, $4)',
            [result.name, result.status, JSON.stringify(result), result.timestamp]
        );
    } catch (error) {
        logger.error('Failed to store health check result:', error);
    }
}

// Send notification for unhealthy service
async function sendNotification(service) {
    if (!process.env.NOTIFICATION_EMAIL) return;

    try {
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: process.env.NOTIFICATION_EMAIL,
            subject: `Service Alert: ${service.name} is unhealthy`,
            text: `Service ${service.name} is reporting unhealthy status.\nTimestamp: ${service.timestamp}\nDetails: ${JSON.stringify(service, null, 2)}`,
            html: `
                <h2>Service Alert: ${service.name}</h2>
                <p>Service is reporting unhealthy status</p>
                <p><strong>Timestamp:</strong> ${service.timestamp}</p>
                <p><strong>Details:</strong></p>
                <pre>${JSON.stringify(service, null, 2)}</pre>
            `
        });
        logger.info(`Notification sent for ${service.name}`);
    } catch (error) {
        logger.error('Failed to send notification:', error);
    }
}

// Check all services
async function checkAllServices() {
    logger.info('Starting health check for all services...');
    
    for (const service of services) {
        const result = await checkServiceHealth(service);
        await storeHealthCheck(result);
        
        if (result.status === 'unhealthy') {
            await sendNotification(result);
        }
    }
    
    logger.info('Health check completed');
}

// Create Express app
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint for the monitor service itself
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT NOW()');
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'monitor'
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            service: 'monitor',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// Get current status of all services
app.get('/api/status', async (req, res) => {
    try {
        const results = await Promise.all(services.map(checkServiceHealth));
        res.json(results);
    } catch (error) {
        logger.error('Failed to get service status:', error);
        res.status(500).json({ error: 'Failed to get service status' });
    }
});

// Get health check history
app.get('/api/history', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM health_checks ORDER BY checked_at DESC LIMIT 100'
        );
        res.json(rows);
    } catch (error) {
        logger.error('Failed to get health check history:', error);
        res.status(500).json({ error: 'Failed to get health check history' });
    }
});

// Get uptime statistics
app.get('/api/stats', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            WITH stats AS (
                SELECT 
                    service_name,
                    COUNT(*) as total_checks,
                    COUNT(*) FILTER (WHERE status = 'healthy') as healthy_checks,
                    MIN(checked_at) as first_check,
                    MAX(checked_at) as last_check
                FROM health_checks
                WHERE checked_at >= NOW() - INTERVAL '24 hours'
                GROUP BY service_name
            )
            SELECT 
                service_name,
                total_checks,
                healthy_checks,
                ROUND((healthy_checks::float / total_checks::float * 100)::numeric, 2) as uptime_percentage,
                first_check,
                last_check
            FROM stats
        `);
        res.json(rows);
    } catch (error) {
        logger.error('Failed to get uptime stats:', error);
        res.status(500).json({ error: 'Failed to get uptime stats' });
    }
});

// Schedule health checks every minute
cron.schedule('* * * * *', checkAllServices);

// Start the server
const port = process.env.PORT || 4004;
app.listen(port, () => {
    logger.info(`Monitor service listening at http://localhost:${port}`);
    // Run initial health check
    checkAllServices();
});
