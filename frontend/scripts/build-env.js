const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });

// Read the template
const envFile = path.join(__dirname, '../js/env.js');
let envContent = fs.readFileSync(envFile, 'utf8');

// Replace placeholders with actual values
envContent = envContent.replace('__TRIVIA_API_KEY__', process.env.TRIVIA_API_KEY || '');
envContent = envContent.replace('__LEADERBOARD_API_KEY__', process.env.LEADERBOARD_API_KEY || '');
envContent = envContent.replace('__NODE_ENV__', process.env.NODE_ENV || 'development');

// Write back to the file
fs.writeFileSync(envFile, envContent);
