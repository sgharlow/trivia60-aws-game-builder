const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const dns = require('dns').promises;
const net = require('net');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const config = require('./config');
const Cache = require('./cache');

const isProduction = process.env.NODE_ENV === 'production';
const REQUEST_TIMEOUT = 25000;
const POSTGRES_CONNECT_TIMEOUT = 20000;
const DEFAULT_QUESTIONS_LIMIT = 10;
const MAX_QUESTIONS_LIMIT = 20;

// Initialize cache
const questionCache = new Cache(300000); // 5 minutes TTL

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_CONCURRENT_REQUESTS = 30; // Reduced from 50
const POOL_CHECK_INTERVAL = 60000; // 60 seconds
const POOL_WARNING_THRESHOLD = 0.8; // 80% capacity warning

let pool = null;
let poolCheckInterval = null;
let isShuttingDown = false;

// Health check function
async function checkPoolHealth() {
    if (!pool) return false;
    
    try {
        const client = await pool.connect();
        try {
            const result = await client.query('SELECT 1');
            return result.rows[0]['?column?'] === 1;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Health check failed:', error);
        return false;
    }
}

// Pool monitoring function
async function monitorPool() {
    if (!pool) return;

    const totalConnections = pool.totalCount;
    const idleConnections = pool.idleCount;
    const maxConnections = config.database.max;
    const utilizationRatio = (totalConnections - idleConnections) / maxConnections;

    // Commented out detailed pool status logging
    // console.log('Pool Status:', {
    //     timestamp: new Date().toISOString(),
    //     totalConnections,
    //     idleConnections,
    //     waitingConnections: pool.waitingCount,
    //     totalPoolSize: maxConnections,
    //     availableConnections: maxConnections - totalConnections + idleConnections
    // });

    if (utilizationRatio >= POOL_WARNING_THRESHOLD) {
        console.warn('Database pool nearing capacity');
    }

    // Perform health check
    const isHealthy = await checkPoolHealth();
    if (!isHealthy) {
        console.error('Pool health check failed, attempting recovery...');
        await reinitializePool();
    }
}

// Initialize pool with retry logic and enhanced monitoring
async function initializePool() {
    try {
        const isDevMode = process.env.NODE_ENV === 'development';
        const dbConfig = {
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'postgres',
            host: process.env.POSTGRES_HOST || (isDevMode ? 'localhost' : 'postgres'),
            port: isDevMode ? 5433 : (parseInt(process.env.POSTGRES_PORT) || 5432),
            database: process.env.POSTGRES_NAME || 'trivia_db',
            max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
            min: parseInt(process.env.POSTGRES_MIN_CONNECTIONS || '5'),
            idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
            connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '5000'),
            statement_timeout: parseInt(process.env.POSTGRES_STATEMENT_TIMEOUT || '10000'),
            query_timeout: parseInt(process.env.POSTGRES_QUERY_TIMEOUT || '15000'),
            application_name: 'trivia_api',
            keepalive: true,
            keepaliveInitialDelayMillis: 10000
        };

        console.log('Initializing pool with config:', {
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            isDevMode: isDevMode,
            max: dbConfig.max,
            min: dbConfig.min
        });

        // Test TCP connection first
        await testTcpConnection(dbConfig.host, dbConfig.port);

        pool = new Pool(dbConfig);

        // Set up error handler
        pool.on('error', (err) => {
            console.error('Unexpected error on idle client:', err);
            if (!isShuttingDown) {
                reinitializePool();
            }
        });

        // Test the connection
        const client = await pool.connect();
        try {
            await client.query('SELECT NOW()');
            console.log('Successfully connected to database');
            
            // Start pool monitoring
            if (poolCheckInterval) {
                clearInterval(poolCheckInterval);
            }
            poolCheckInterval = setInterval(monitorPool, POOL_CHECK_INTERVAL);
            
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Failed to initialize pool:', error);
        throw error;
    }
}

// Reinitialize pool if needed
async function reinitializePool() {
    console.log('Attempting to reinitialize pool...');
    if (pool) {
        try {
            await pool.end();
        } catch (error) {
            console.error('Error ending pool:', error);
        }
    }
    await initializePool();
}

// Validate query parameters
function validateQueryParams(req, res, next) {
    const limit = parseInt(req.query.limit) || DEFAULT_QUESTIONS_LIMIT;
    const difficulty = req.query.difficulty;
    const category = req.query.category;

    if (limit > MAX_QUESTIONS_LIMIT) {
        return res.status(400).json({
            status: 'error',
            message: `Limit cannot exceed ${MAX_QUESTIONS_LIMIT} questions`
        });
    }

    if (difficulty && !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid difficulty level. Must be Easy, Medium, or Hard'
        });
    }

    // Store validated params
    req.validatedParams = {
        limit,
        difficulty,
        category
    };

    next();
}

// Test TCP connection to database
async function testTcpConnection(host, port) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(5000);

        socket.on('connect', () => {
            console.log('TCP connection successful');
            socket.end();
            resolve(true);
        });

        socket.on('timeout', () => {
            console.log('TCP connection timeout');
            socket.destroy();
            resolve(false);
        });

        socket.on('error', (err) => {
            console.log('TCP connection error:', err);
            resolve(false);
        });

        socket.connect(port, host);
    });
}

// Helper function for retrying database operations
async function withRetry(operation, maxRetries = MAX_RETRIES) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            console.error(`Attempt ${i + 1}/${maxRetries} failed:`, error.message);
            lastError = error;
            
            // Don't retry if it's a query timeout or validation error
            if (error.message.includes('timeout') || 
                error.message.includes('validation') ||
                error.code === '23505') { // Unique violation
                throw error;
            }
            
            if (i < maxRetries - 1) {
                const delay = Math.min(RETRY_DELAY * Math.pow(2, i), 10000);
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

// Queue for managing concurrent requests
const requestQueue = [];
let activeRequests = 0;

async function processQueue() {
    while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
        const { operation, resolve, reject, timeout } = requestQueue.shift();
        activeRequests++;
        
        try {
            const result = await operation();
            clearTimeout(timeout);
            resolve(result);
        } catch (error) {
            clearTimeout(timeout);
            reject(error);
        } finally {
            activeRequests--;
            if (requestQueue.length > 0) {
                setImmediate(processQueue);
            }
        }
    }
}

async function queueRequest(operation) {
    // Check cache first
    const cacheKey = operation.toString();
    const cachedResult = questionCache.get(cacheKey);
    if (cachedResult) {
        console.log('Cache hit');
        return cachedResult;
    }

    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
        activeRequests++;
        try {
            const result = await operation();
            questionCache.set(cacheKey, result);
            return result;
        } finally {
            activeRequests--;
            if (requestQueue.length > 0) {
                setImmediate(processQueue);
            }
        }
    }

    if (requestQueue.length >= config.server.maxRequestQueue) {
        throw new Error('Server is too busy. Please try again later.');
    }

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            const index = requestQueue.findIndex(req => req.timeout === timeout);
            if (index !== -1) {
                requestQueue.splice(index, 1);
                reject(new Error('Request timeout while waiting in queue'));
            }
        }, config.server.requestTimeout);

        requestQueue.push({ operation, resolve, reject, timeout });
        setImmediate(processQueue);
    });
}

// Helper function to build the query
function buildQuery(numQuestions, category, difficulty) {
    const baseQuery = `
        SELECT 
            id,
            question,
            options,
            correct_answer,
            text_hint,
            image_hint,
            explanation,
            category,
            difficulty,
            created_at
        FROM public.trivia_questions
    `;

    const conditions = [];
    const params = [numQuestions];
    let paramIndex = 2;

    if (category) {
        conditions.push(`category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
    }

    if (difficulty) {
        conditions.push(`difficulty = $${paramIndex}`);
        params.push(difficulty);
        paramIndex++;
    }

    const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';

    const query = `
        ${baseQuery}
        ${whereClause}
        ORDER BY RANDOM() 
        LIMIT $1
    `;

    return { query, params };
}

// Enhanced question validation with detailed checks
function validateQuestion(question) {
    const errors = [];
    
    // Check required fields
    const requiredFields = [
        'id', 'question', 'options', 'correct_answer', 
        'text_hint', 'explanation', 'category', 'difficulty'
    ];
    for (const field of requiredFields) {
        if (question[field] === undefined || question[field] === null) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    // Validate question text
    if (question.question) {
        if (typeof question.question !== 'string') {
            errors.push('Question must be a string');
        } else if (question.question.length < 10) {
            errors.push('Question text is too short (minimum 10 characters)');
        } else if (question.question.length > 500) {
            errors.push('Question text is too long (maximum 500 characters)');
        }
    }

    // Validate options array
    if (question.options) {
        if (!Array.isArray(question.options)) {
            errors.push('Options must be an array');
        } else if (question.options.length !== 4) {
            errors.push('Must have exactly 4 options');
        } else if (!question.options.every(opt => typeof opt === 'string')) {
            errors.push('All options must be strings');
        }
    }

    // Validate correct_answer
    if (question.correct_answer !== undefined) {
        const correctAnswer = parseInt(question.correct_answer);
        if (isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
            errors.push('Correct answer must be a number between 0 and 3');
        }
    }

    // Validate text_hint
    if (question.text_hint && typeof question.text_hint !== 'string') {
        errors.push('Text hint must be a string');
    }

    // Validate explanation
    if (question.explanation && typeof question.explanation !== 'string') {
        errors.push('Explanation must be a string');
    }

    // Validate category
    if (question.category && typeof question.category !== 'string') {
        errors.push('Category must be a string');
    }

    // Validate difficulty
    if (question.difficulty) {
        if (typeof question.difficulty !== 'string') {
            errors.push('Difficulty must be a string');
        } else if (!['Easy', 'Medium', 'Hard'].includes(question.difficulty)) {
            errors.push('Difficulty must be one of: Easy, Medium, Hard');
        }
    }

    return errors;
}

// Helper function to transform database response to frontend format
function transformQuestionFormat(dbQuestion) {
    try {
        // Commented out detailed transformation logging
        // console.log('Transforming question:', JSON.stringify(dbQuestion, null, 2));
        
        // Basic validation
        if (!dbQuestion || typeof dbQuestion !== 'object') {
            throw new Error('Invalid question data: not an object');
        }
        if (!Array.isArray(dbQuestion.options) || dbQuestion.options.length !== 4) {
            throw new Error('Invalid options format');
        }
        const correctAnswerIndex = parseInt(dbQuestion.correct_answer);
        if (isNaN(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex > 3) {
            throw new Error('Invalid correct_answer');
        }

        // Transform with safe defaults
        const transformed = {
            id: dbQuestion.id,
            question: dbQuestion.question,
            options: dbQuestion.options,
            correct_answer: correctAnswerIndex,
            text_hint: dbQuestion.text_hint || null,
            image_hint: dbQuestion.image_hint || null,
            explanation: dbQuestion.explanation,
            category: dbQuestion.category,
            difficulty: dbQuestion.difficulty
        };

        // Commented out detailed transformation logging
        // console.log('Transformed question:', JSON.stringify(transformed, null, 2));
        return transformed;
    } catch (error) {
        console.error('Error transforming question:', {
            error: error.message,
            stack: error.stack,
            question: JSON.stringify(dbQuestion, null, 2)
        });
        throw error;
    }
}

// Modify the getQuestions function to use enhanced error handling and filtering
async function getQuestions(req, res) {
    const { limit, difficulty, category } = req.validatedParams;
    
    try {
        // First try to get questions from database
        const result = await queueRequest(async () => {
            const { query, params } = buildQuery(limit, category, difficulty);
            // Commented out detailed query logging
            // console.log('Executing query:', { query, params });
            
            const dbResult = await withRetry(async () => {
                const client = await pool.connect();
                try {
                    return await client.query(query, params);
                } finally {
                    client.release();
                }
            });

            return dbResult.rows;
        });

        if (result && result.length > 0) {
            // Validate database results
            const validQuestions = result.filter(q => {
                const errors = validateQuestion(q);
                if (errors.length > 0) {
                    console.warn(`Invalid database question ${q.id}:`, errors);
                    return false;
                }
                return true;
            }).map(transformQuestionFormat);

            if (validQuestions.length > 0) {
                return res.json({
                    status: 'success',
                    data: validQuestions,
                    source: 'database'
                });
            }
        }

        // Fallback to mock data if database query returns no results
        console.log('Attempting to use mock data as fallback');
        const mockData = mockQuestions.map(transformQuestionFormat);
        const validMockQuestions = mockData.filter(q => {
            const errors = validateQuestion(q);
            if (errors.length > 0) {
                console.warn(`Invalid mock question ${q.id}:`, errors);
                return false;
            }
            return true;
        });

        if (validMockQuestions.length === 0) {
            throw new Error('No valid questions available (both database and mock data failed validation)');
        }

        // Shuffle and limit mock questions
        const shuffled = validMockQuestions.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, limit);

        return res.json({
            status: 'success',
            data: selected,
            source: 'mock'
        });

    } catch (error) {
        console.error('Error in getQuestions:', error);
        return res.status(500).json({
            status: 'error',
            message: 'An error occurred while processing your request',
            timestamp: new Date().toISOString()
        });
    }
}

const createApp = () => {
    const app = express();
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        ['http://localhost:3000', 'http://localhost:8088', 'https://trivia60.com'];
    
    // Initialize pool before setting up routes
    initializePool().catch(err => {
        console.error('Failed to initialize pool:', err);
        process.exit(1);
    });
    
    // Configure CORS
    app.use(cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                console.warn(`Origin ${origin} not allowed by CORS`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Api-Key'],
        credentials: true,
        maxAge: 86400,
        preflightContinue: false,
        optionsSuccessStatus: 204
    }));

    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "http://localhost:*", "https://trivia60.com"]
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
    app.use(rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 2000, // Limit each IP to 2000 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false
    }));

    // Graceful shutdown handler
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received, starting graceful shutdown');
        await cleanupPool();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('SIGINT received, starting graceful shutdown');
        await cleanupPool();
        process.exit(0);
    });

    // Health check endpoint
    app.get('/api/health', async (req, res) => {
        try {
            const isHealthy = await checkPoolHealth();
            if (isHealthy) {
                res.json({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    service: 'get-questions',
                    database: 'connected'
                });
            } else {
                throw new Error('Database health check failed');
            }
        } catch (error) {
            console.error('Health check failed:', error);
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                service: 'get-questions',
                database: 'disconnected',
                error: process.env.NODE_ENV === 'production' ? undefined : error.message
            });
        }
    });

    // Get questions endpoint with enhanced error handling and filtering
    app.get('/api/questions', validateQueryParams, getQuestions);

    // Generic error handler
    app.use((err, req, res, next) => {
        console.error('Unhandled error:', err);
        res.status(500).json({
            status: 'error',
            message: isProduction ? 'Internal server error' : err.message
        });
    });

    // Start server
    const port = process.env.PORT || 4001;
    app.listen(port, () => {
        console.log(`Questions API listening at http://localhost:${port}`);
        console.log(`Test with: curl http://localhost:${port}/api/questions`);
    });

    return app;
};

// Cleanup pool properly
async function cleanupPool() {
    if (poolCheckInterval) {
        clearInterval(poolCheckInterval);
        poolCheckInterval = null;
    }

    if (pool) {
        console.log('Cleaning up connection pool');
        await pool.end();
        pool = null;
    }
}

// Mock questions that exactly match the database schema
const mockQuestions = [
    {
        id: 1,
        question: "What is the capital of France?",
        options: ["London", "Paris", "Berlin", "Madrid"],
        correct_answer: 1,
        text_hint: "This city is known as the City of Light",
        image_hint: null,
        explanation: "Paris is the capital and largest city of France",
        category: "Geography",
        difficulty: "Easy"
    },
    {
        id: 2,
        question: "Which planet is known as the Red Planet?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correct_answer: 1,
        text_hint: "This planet's color comes from iron oxide",
        image_hint: null,
        explanation: "Mars appears red due to iron oxide (rust) on its surface",
        category: "Science",
        difficulty: "Easy"
    },
    {
        id: 3,
        question: "What is the largest mammal on Earth?",
        options: ["African Elephant", "Blue Whale", "Giraffe", "Hippopotamus"],
        correct_answer: 1,
        text_hint: "This animal lives in the ocean",
        image_hint: null,
        explanation: "The Blue Whale is the largest animal known to have ever existed",
        category: "Science",
        difficulty: "Easy"
    }
];

// Helper function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

module.exports = { createApp };
