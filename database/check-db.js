require('dotenv').config();
const { Client } = require('pg');

async function checkDatabase() {
    const client = new Client({
        host: process.env.POSTGRES_HOST,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_NAME,
        port: process.env.POSTGRES_PORT
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Query questions
        const questionsResult = await client.query('SELECT COUNT(*) as count FROM trivia_questions');
        console.log('\nTotal questions:', questionsResult.rows[0].count);

        // Query recent questions
        const recentQuestions = await client.query(`
            SELECT id, question, options, correct_answer, explanation, hint, category, difficulty, image_url, created_at
            FROM trivia_questions
            ORDER BY created_at DESC
            LIMIT 5
        `);

        console.log('\nMost recent questions:');
        recentQuestions.rows.forEach(q => {
            console.log('\n----------------------------------------');
            console.log('Question ID:', q.id);
            console.log('Question:', q.question);
            console.log('Category:', q.category);
            console.log('Difficulty:', q.difficulty);
            console.log('Options:', q.options);
            console.log('Correct Answer:', q.correct_answer);
            console.log('Hint:', q.hint);
            console.log('Has Image:', !!q.image_url);
            console.log('Created At:', q.created_at);
            console.log('----------------------------------------\n');
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkDatabase().catch(console.error);
