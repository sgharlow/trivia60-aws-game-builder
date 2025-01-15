const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_NAME,
    port: process.env.POSTGRES_PORT,
    ssl: {
        rejectUnauthorized: false
    }
});

const createTableQuery = `
    CREATE TABLE IF NOT EXISTS leaderboard (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        score INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`;

exports.handler = async (event) => {
    let client;
    try {
        const origin = event.headers.origin || event.headers.Origin || 'https://www.trivia60.com';
        const allowedOrigins = ['https://trivia60.com', 'https://www.trivia60.com'];
        const headers = {
            'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
            'Content-Type': 'application/json'
        };

        // Handle OPTIONS request for CORS
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'CORS enabled' })
            };
        }

        client = await pool.connect();
        
        // Create table if it doesn't exist
        await client.query(createTableQuery);

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { username, score } = body;

            if (!username || !score) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing username or score' })
                };
            }

            const query = 'INSERT INTO leaderboard (username, score) VALUES ($1, $2)';
            await client.query(query, [username, score]);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Score added successfully' })
            };
        }

        if (event.httpMethod === 'GET') {
            const query = 'SELECT username, score, created_at FROM leaderboard ORDER BY score DESC LIMIT 5';
            const result = await client.query(query);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result.rows)
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    } finally {
        if (client) {
            await client.release();
        }
    }
};
