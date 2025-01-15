const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Debug environment variables
console.log('=== Environment Variables ===', {
    allowedOrigins: process.env.ALLOWED_ORIGINS,
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    timestamp: new Date().toISOString()
});

const isProduction = process.env.NODE_ENV === 'production';
const REQUEST_TIMEOUT = 30000; // Increased to 30 seconds
const POSTGRES_CONNECT_TIMEOUT = 20000; // Increased to 20 seconds
const MAX_RETRIES = 5; // Increased retries

// Database configuration
const dbConfig = {
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'), // Remove localhost condition since we're in container
    database: process.env.POSTGRES_NAME,
    ssl: false,
    connectionTimeoutMillis: POSTGRES_CONNECT_TIMEOUT,
    idleTimeoutMillis: 60000,
    max: 10,
    keepAlive: true,
    statement_timeout: 20000
};

// Create a single connection pool to be reused
const pool = new Pool(dbConfig);

// Enhanced error logging for pool
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', {
        message: err.message,
        code: err.code,
        detail: err.detail,
        hint: err.hint,
        stack: err.stack,
        connectionConfig: {
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user
        }
    });
    if (client) {
        client.release(true);
    }
});

// Create leaderboard table if not exists
const initializeDatabase = async () => {
    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS leaderboard (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                score INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
        `;
        
        await pool.query(createTableQuery);
        console.log('Leaderboard table initialized successfully');
    } catch (err) {
        console.error('Failed to initialize leaderboard table:', {
            message: err.message,
            code: err.code,
            detail: err.detail,
            hint: err.hint
        });
        throw err;
    }
};

// Call initialization on startup
initializeDatabase().catch(console.error);

// Mock leaderboard for fallback
const mockLeaderboard = [
    {
        username: "Sample Player",
        score: 1000,
        created_at: new Date().toISOString()
    }
];

const app = express();

// CORS configuration
app.use((req, res, next) => {
    // Log CORS request details
    console.log('=== CORS Request ===', {
        origin: req.headers.origin,
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
    });

    res.header('Access-Control-Allow-Origin', 'http://localhost:8088');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Api-Key');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        console.log('=== Handling OPTIONS request ===', {
            origin: req.headers.origin,
            method: req.method,
            headers: req.headers,
            timestamp: new Date().toISOString()
        });
        return res.status(204).send();
    }
    next();
});

// Parse JSON bodies
app.use(express.json());

// Configure rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT NOW()');
        res.json({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            service: 'leaderboard',
            database: 'connected'
        });
    } catch (err) {
        console.error('Health check failed:', err);
        res.status(503).json({ 
            status: 'unhealthy', 
            timestamp: new Date().toISOString(),
            service: 'leaderboard',
            database: 'disconnected',
            error: isProduction ? 'Service unavailable' : err.message
        });
    }
});

// Rate limiter for submissions
const submitLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10 // limit each IP to 10 submissions per minute
});

// POST endpoint to submit a new score
app.post('/api/submit-score', submitLimiter, async (req, res) => {
    console.log('=== Score Submission Request ===', {
        body: req.body,
        headers: req.headers,
        ip: req.ip,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    try {
        const { username, score } = req.body;

        // Input validation
        if (!username || typeof username !== 'string') {
            console.warn('=== Invalid Username ===', {
                username,
                type: typeof username,
                timestamp: new Date().toISOString()
            });
            return res.status(400).json({ error: 'Invalid username' });
        }

        if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
            console.warn('=== Invalid Score ===', {
                score,
                type: typeof score,
                isInteger: Number.isInteger(score),
                timestamp: new Date().toISOString()
            });
            return res.status(400).json({ error: 'Score must be a non-negative integer' });
        }

        // Clean username
        const cleanUsername = username.trim().slice(0, 50);

        // Get a client from the pool
        const client = await pool.connect();
        console.log('=== Database Connection Acquired ===', {
            timestamp: new Date().toISOString()
        });

        try {
            // Start transaction
            await client.query('BEGIN');

            // Insert the score
            const insertQuery = `
                INSERT INTO leaderboard (username, score)
                VALUES ($1, $2)
                RETURNING id, username, score, created_at;
            `;

            console.log('=== Executing Insert Query ===', {
                username: cleanUsername,
                score,
                timestamp: new Date().toISOString()
            });

            const result = await client.query(insertQuery, [cleanUsername, score]);
            
            // Commit transaction
            await client.query('COMMIT');

            console.log('=== Score Inserted Successfully ===', {
                result: result.rows[0],
                timestamp: new Date().toISOString()
            });

            res.status(201).json(result.rows[0]);
        } catch (dbError) {
            // Rollback transaction on error
            await client.query('ROLLBACK');

            console.error('=== Database Error ===', {
                message: dbError.message,
                code: dbError.code,
                detail: dbError.detail,
                hint: dbError.hint,
                position: dbError.position,
                timestamp: new Date().toISOString()
            });

            throw dbError;
        } finally {
            // Always release the client back to the pool
            client.release();
            console.log('=== Database Connection Released ===', {
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('=== Score Submission Error ===', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // Send appropriate error response
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({
                error: 'Duplicate entry',
                message: 'This score has already been submitted'
            });
        }

        if (error.code === '23502') { // Not null violation
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Username and score are required'
            });
        }

        if (error.code === '23514') { // Check violation
            return res.status(400).json({
                error: 'Invalid data',
                message: 'Score must be a non-negative integer'
            });
        }

        // Generic database error
        return res.status(500).json({
            error: 'Database error',
            message: 'Failed to save score. Please try again later.'
        });
    }
});

// Get leaderboard endpoint with retry logic
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT username, score, created_at
            FROM leaderboard 
            WHERE DATE(created_at) = CURRENT_DATE
            ORDER BY score DESC, created_at DESC 
            LIMIT 10
        `);
        
        if (result.rows && result.rows.length > 0) {
            console.log('Successfully retrieved today\'s leaderboard');
            return res.json(result.rows);
        } else {
            console.log('No leaderboard entries found for today');
            return res.json([]);  // Return empty array instead of mock data
        }
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({
            error: 'Failed to fetch leaderboard',
            details: isProduction ? undefined : err.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Express error:', err);
    res.status(500).json({
        error: 'Server error',
        message: isProduction ? 'Internal server error' : err.message
    });
});

module.exports = app;