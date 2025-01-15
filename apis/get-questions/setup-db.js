require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
    user: 'reddit',
    password: 'YourPassword',
    host: 'YourHost',
    port: 5432,
    database: 'trivia_db',
    ssl: { rejectUnauthorized: false }
};

async function setupDatabase() {
    const pool = new Pool(dbConfig);
    
    try {
        // Read and execute the migration file
        const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrations', 'init.sql'), 'utf8');
        await pool.query(migrationSQL);
        console.log('Database tables created successfully');
    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        await pool.end();
    }
}

setupDatabase();
