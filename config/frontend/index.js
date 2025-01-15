require('dotenv').config();
const { OpenAI } = require('openai');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const s3Utils = require('./shared/s3-utils');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Determine if running in Lambda
const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

// Parse POSTGRES_URL and create appropriate config
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

// Initialize PostgreSQL connection
const pool = new Pool(config);

// Utility function for delay between retries
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Content filter for Reddit posts
function isAppropriateContent(post) {
    const inappropriateKeywords = [
        'nsfw', 'nsfl', 'gore', 'death', 'violence', 'explicit',
        'murder', 'kill', 'blood', 'suicide', 'porn', 'sex'
    ];
    
    const lowercaseTitle = post.title.toLowerCase();
    const lowercaseSubreddit = post.subreddit.toLowerCase();
    
    return !inappropriateKeywords.some(keyword => 
        lowercaseTitle.includes(keyword) || 
        lowercaseSubreddit.includes(keyword)
    );
}

async function getRedditTrends() {
    console.log('Using test topics for development');
    // Test topics for development
    return [
        { title: "Scientists discover new species in Amazon rainforest", subreddit: "science" },
        { title: "SpaceX successfully launches Starship prototype", subreddit: "space" },
        { title: "Ancient Roman coins found in Mediterranean shipwreck", subreddit: "history" },
        { title: "New breakthrough in quantum computing announced", subreddit: "technology" },
        { title: "Researchers develop more efficient solar panels", subreddit: "environment" }
    ];
}

async function generateQuestion(topic) {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            // Clean and sanitize the topic
            const sanitizedTitle = topic.title
                .replace(/[^\w\s.,!?-]/g, '')
                .trim();
            const sanitizedSubreddit = topic.subreddit
                .replace(/[^\w\s]/g, '')
                .trim();

            const prompt = `Create a family-friendly trivia question based on this topic: "${sanitizedTitle}" from r/${sanitizedSubreddit}.
            Format the response as a JSON object with these fields:
            - question: the trivia question (keep it general and educational)
            - correct_answer: the correct answer
            - incorrect_answers: array of exactly 3 plausible but incorrect answers (make them challenging and related to the topic)
            - hint: a helpful hint that doesn't give away the answer
            - hint_image_prompt: a safe, family-friendly prompt to generate an image hint using DALL-E
            Make the question educational and suitable for all ages. Ensure incorrect answers are distinct from each other and the correct answer.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 500,
            });

            let questionData;
            try {
                questionData = JSON.parse(completion.choices[0].message.content);
                
                // Validate the response format
                if (!questionData.correct_answer || !Array.isArray(questionData.incorrect_answers) || 
                    questionData.incorrect_answers.length !== 3) {
                    throw new Error('Invalid response format from OpenAI');
                }
                
                // Generate image hint using DALL-E
                if (questionData.hint_image_prompt) {
                    try {
                        const imageResponse = await openai.images.generate({
                            prompt: questionData.hint_image_prompt,
                            n: 1,
                            size: "1024x1024"
                        });

                        questionData.hint_image_url = imageResponse.data[0].url;
                        console.log('Successfully generated image hint:', questionData.hint_image_url);
                    } catch (error) {
                        console.error('Error generating image hint:', error);
                        questionData.hint_image_url = null;
                    }
                }

                // Prepare the options array and find correct answer index
                const allOptions = [questionData.correct_answer, ...questionData.incorrect_answers];
                const correctAnswerIndex = 0; // Since we put the correct answer first

                return {
                    question: questionData.question,
                    answers: allOptions,
                    correct_answer_index: correctAnswerIndex,
                    hint: questionData.hint,
                    hint_image_url: questionData.hint_image_url
                };
            } catch (parseError) {
                console.error('Error parsing OpenAI response:', parseError);
                throw new Error('Invalid response format from OpenAI');
            }

        } catch (error) {
            attempt++;
            console.error(`Question generation attempt ${attempt} failed for topic "${topic.title}":`, error);
            
            if (error.error?.code === 'content_policy_violation') {
                console.log('Content policy violation, skipping this topic');
                throw new Error('SKIP_TOPIC');
            }
            
            if (attempt === maxRetries) {
                throw new Error('SKIP_TOPIC');
            }
            
            await delay(2000 * attempt); // Exponential backoff
        }
    }
}

async function saveToDatabase(questions) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Clear existing questions and their hints
        await client.query('DELETE FROM hints');
        await client.query('DELETE FROM questions');
        
        // Insert new questions
        for (const q of questions) {
            // Insert question with all options and correct answer index
            const questionResult = await client.query(
                `INSERT INTO questions (
                    question,
                    answers,
                    correct_answer,
                    created_at
                ) VALUES ($1, $2, $3, NOW()) RETURNING question_id`,
                [
                    q.question,
                    JSON.stringify(q.answers), // Array of all 4 answers
                    q.correct_answer_index, // Index of correct answer (0-3)
                ]
            );
            
            const questionId = questionResult.rows[0].question_id;
            
            // Insert hint
            await client.query(
                `INSERT INTO hints (
                    question_id,
                    hint_detail,
                    hint_type,
                    created_at
                ) VALUES ($1, $2, $3, NOW())`,
                [
                    questionId,
                    q.hint,
                    'text'
                ]
            );

            // If we have an image hint, store it in S3 and insert it
            if (q.hint_image_url) {
                try {
                    // Upload image to S3 and get permanent URL
                    const signedUrl = await s3Utils.uploadFromUrl(q.hint_image_url);
                    
                    await client.query(
                        `INSERT INTO hints (
                            question_id,
                            hint_detail,
                            hint_type,
                            created_at
                        ) VALUES ($1, $2, $3, NOW())`,
                        [
                            questionId,
                            signedUrl,
                            'image'
                        ]
                    );
                    
                    console.log(`Successfully stored image hint: ${signedUrl}`);
                } catch (error) {
                    console.error('Error storing image hint in S3:', error);
                    // Continue with other questions even if one image fails
                }
            }
        }
        
        await client.query('COMMIT');
        console.log('Successfully updated questions and hints in database');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving questions to database:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function main() {
    console.log(`Starting question generation in ${isLambda ? 'Lambda' : 'local'} environment`);
    
    try {
        // Test database connection
        const client = await pool.connect();
        try {
            const result = await client.query('SELECT NOW()');
            console.log('Database connection successful:', result.rows[0].now);
        } finally {
            client.release();
        }

        // Fetch trending topics from Reddit
        const trends = await getRedditTrends();
        console.log('Fetched trending topics:', trends.map(t => t.title));

        // Generate questions for each trend
        const questions = [];
        for (const trend of trends.slice(0, 5)) { // Limit to 5 questions
            try {
                const question = await generateQuestion(trend);
                if (question) {
                    questions.push(question);
                }
            } catch (error) {
                console.error(`Error generating question for trend "${trend.title}":`, error);
            }
            // Add delay between questions to respect API rate limits
            await delay(1000);
        }

        // Save questions to database
        if (questions.length > 0) {
            await saveToDatabase(questions);
            console.log(`Successfully generated and saved ${questions.length} questions`);
        } else {
            throw new Error('No questions were generated successfully');
        }

        if (isLambda) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: `Successfully generated ${questions.length} questions`,
                    timestamp: new Date().toISOString()
                })
            };
        }
    } catch (error) {
        console.error('Error in main process:', error);
        if (isLambda) {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'Failed to generate questions',
                    message: error.message,
                    timestamp: new Date().toISOString()
                })
            };
        }
        throw error;
    }
}

// Export for Lambda
exports.handler = async (event, context) => {
    return await main();
};

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
