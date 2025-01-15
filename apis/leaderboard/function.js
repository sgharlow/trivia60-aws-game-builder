const { Client } = require('pg');

// Initialize PostgreSQL client
const client = new Client({
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT || 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

let isConnected = false;

const connectToDatabase = async () => {
    if (!isConnected) {
        await client.connect();
        isConnected = true;
    }
};

exports.handler = async (event, context) => {
    try {
        // Set up CORS headers
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
        };

        await connectToDatabase();

        // GET /leaderboard
        if (event.httpMethod === 'GET' && event.path === '/leaderboard') {
            const query = `
                WITH RankedScores AS (
                    SELECT 
                        username,
                        score,
                        created_at,
                        ROW_NUMBER() OVER (PARTITION BY username ORDER BY score DESC, created_at DESC) as rn
                    FROM leaderboard 
                    WHERE DATE(created_at) = CURRENT_DATE
                )
                SELECT username, score, created_at
                FROM RankedScores
                WHERE rn = 1
                ORDER BY score DESC, created_at DESC
                LIMIT 10
            `;
            
            const result = await client.query(query);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result.rows)
            };
        }
        
        // POST /set_leaderboard
        if (event.httpMethod === 'POST' && event.path === '/set_leaderboard') {
            const body = JSON.parse(event.body);
            const { date, time, score, username } = body;
            
            await client.query(
                `INSERT INTO leaderboard (date, time, score, username) VALUES ($1, $2, $3, $4)`,
                [date, time, score, username]
            );
            
            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ message: 'Leaderboard entry created' })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: 'Not Found' })
        };
    } catch (err) {
        console.error('Error:', err);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({ message: err.message })
        };
    }
};