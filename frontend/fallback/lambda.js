const { Pool } = require('pg');

// Initialize PostgreSQL connection
const dbUrl = new URL(process.env.POSTGRES_URL);
const config = {
    user: dbUrl.username,
    password: decodeURIComponent(dbUrl.password),
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port || '5432'),
    database: dbUrl.pathname.slice(1),
    ssl: {
        rejectUnauthorized: false
    }
};

const pool = new Pool(config);

// Validate and get the correct origin
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://your-own-s3-bucket.s3.us-east-1.amazonaws.com',
    'http://your-own-s3-bucket.s3.us-east-1.amazonaws.com'
];

// Helper function to create response
const createResponse = (statusCode, body, headers = {}) => ({
    statusCode,
    body: JSON.stringify(body)
});

exports.handler = async (event) => {
    // Validate and get the correct origin
    const origin = event.headers?.origin || event.headers?.Origin;
    const validOrigin = allowedOrigins.includes(origin) ? origin : 'https://your-own-s3-bucket.s3.us-east-1.amazonaws.com';
    
    // Handle OPTIONS request for CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    try {
        // Parse count parameter, default to 6 if not provided
        const count = event.queryStringParameters?.count ? 
            parseInt(event.queryStringParameters.count) : 6;

        // Get questions from database
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT * FROM trivia_questions ORDER BY RANDOM() LIMIT $1',
                [count]
            );
            
            return createResponse(200, result.rows);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Database error:', error);
        return createResponse(500, { error: 'Internal server error' });
    }
};
