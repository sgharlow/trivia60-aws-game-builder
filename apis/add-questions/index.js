require('dotenv').config();
const { OpenAI } = require('openai');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { Pool } = require('pg');
const axios = require('axios');
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const cors = require('cors');

// Determine if running in Lambda
const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

// Configuration
const CONFIG = {
    QUESTIONS_PER_DAY: 10, //
    RATE_LIMIT_DELAY: 2000, // 2 seconds between API calls
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second between retries
    BATCH_SIZE: 2, // Process questions in batches to avoid rate limits
    GENERATE_IMAGE_HINTS: true // Generate image hints using DALL-E
};

const requiredEnvVars = {
    // Database
    'POSTGRES_HOST': 'Database host',
    'POSTGRES_USER': 'Database user',
    'POSTGRES_PASSWORD': 'Database password',
    'POSTGRES_NAME': 'Database name',
    'POSTGRES_PORT': 'Database port',
    // AWS
    'AWS_REGION': 'AWS region',
    'AWS_ACCESS_KEY_ID': 'AWS access key',
    'AWS_SECRET_ACCESS_KEY': 'AWS secret key',
    'S3_BUCKET_NAME': 'S3 bucket name',
    // OpenAI
    'OPENAI_API_KEY': 'OpenAI API key',
    // Reddit
    'REDDIT_CLIENT_ID': 'Reddit client ID',
    'REDDIT_CLIENT_SECRET': 'Reddit client secret'
};

function validateEnvironment() {
    const missing = [];
    for (const [key, description] of Object.entries(requiredEnvVars)) {
        if (!process.env[key]) {
            missing.push(`${description} (${key})`);
        }
    }
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables:\n${missing.join('\n')}`);
    }
}

// Rate limiting and retry configuration
const RATE_LIMIT_DELAY = CONFIG.RATE_LIMIT_DELAY;
const MAX_RETRIES = CONFIG.MAX_RETRIES;
const RETRY_DELAY = CONFIG.RETRY_DELAY;

async function withRateLimit(fn) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    return fn();
}

async function withRetry(fn) {
    let lastError;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.error(`Attempt ${i + 1}/${MAX_RETRIES} failed:`, error.message);
            if (i < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, i)));
            }
        }
    }
    throw lastError;
}

// S3 Utils Class
class S3Utils {
    constructor() {
        const bucketName = process.env.S3_BUCKET_NAME;

        if (!bucketName) {
            console.error('Missing required S3 bucket name');
            throw new Error('Missing required S3 bucket name');
        }

        // In Lambda, use the IAM role credentials
        if (isLambda) {
            this.s3 = new S3Client({});
        } else {
            // For local development, use environment variables
            const region = process.env.AWS_REGION;
            const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
            const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

            if (!region || !accessKeyId || !secretAccessKey) {
                console.error('Missing required AWS configuration:', {
                    region: !!region,
                    accessKeyId: !!accessKeyId,
                    secretAccessKey: !!secretAccessKey
                });
                throw new Error('Missing required AWS configuration');
            }

            this.s3 = new S3Client({
                region,
                credentials: {
                    accessKeyId,
                    secretAccessKey
                }
            });
        }

        this.bucketName = bucketName;
        console.log('S3Utils initialized with bucket:', this.bucketName);
    }

    async getSignedUrl(key, expirationSeconds = 604800) {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });

        try {
            const url = await getSignedUrl(this.s3, command, { expiresIn: expirationSeconds });
            return url;
        } catch (error) {
            console.error('Error generating signed URL:', error);
            throw error;
        }
    }

    async uploadFromUrl(imageUrl, folder = 'hints') {
        try {
            // Download the image
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');

            // Generate a unique filename
            const extension = 'png';  // DALL-E images are always PNG
            const filename = `${uuidv4()}.${extension}`;
            const key = `${folder}/${filename}`;

            // Upload to S3
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: 'image/png'
            });

            await this.s3.send(command);
            console.log('Successfully uploaded image to S3:', key);

            return key;
        } catch (error) {
            console.error('Error uploading image to S3:', error);
            throw error;
        }
    }

    async fileExists(key) {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            await this.s3.send(command);
            return true;
        } catch (error) {
            if (error.name === 'NotFound') {
                return false;
            }
            throw error;
        }
    }
}

// Database configuration helper
function getDatabaseConfig() {
    // Check if we're in development mode
    const isDevMode = process.env.NODE_ENV === 'development';
    console.log('Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        isDevMode: isDevMode
    });

    // take this into get questions as well
    const config = {
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        host: process.env.POSTGRES_HOST || (isDevMode ? 'localhost' : 'postgres'),
        port: isDevMode ? 5433 : (parseInt(process.env.POSTGRES_PORT) || 5432),
        database: process.env.POSTGRES_NAME || 'trivia_db',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };

    console.log('Database configuration:', {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        isDevMode: isDevMode
    });

    return config;
}

// Create pool variable
let pool;

// Initialize pool if not in test mode
if (!process.env.TEST_REDDIT) {
    // Create a new pool using the configuration
    pool = new Pool(getDatabaseConfig());

    // Test database connection on startup
    pool.connect()
        .then(client => {
            console.log('Successfully connected to PostgreSQL');
            client.release();
        })
        .catch(err => {
            console.error('Error connecting to PostgreSQL:', err);
            // Don't exit, let the service retry connections
        });
}

// Export the S3Utils class and handler
const createApp = () => {
    const app = express();
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        ['http://localhost:3000', 'http://localhost:5000']

    // CORS configuration
    const corsConfig = {
        origin: function(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
        credentials: true,
        maxAge: 86400,
        optionsSuccessStatus: 204
    };

    app.use(cors(corsConfig));
    app.use(express.json());

    // Health check endpoint
    app.get('/api/health', async (req, res) => {
        try {
            // Test database connection
            await pool.query('SELECT 1');
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'add-questions',
                database: 'connected'
            });
        } catch (error) {
            console.error('Health check failed:', error);
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                service: 'add-questions',
                database: 'disconnected',
                error: process.env.NODE_ENV === 'production' ? undefined : error.message
            });
        }
    });

    // Endpoint to manually trigger question generation
    app.post('/api/generate', async (req, res) => {
        try {
            console.log('Manually triggering question generation...');
            await main();
            res.json({ status: 'success', message: 'Question generation completed' });
        } catch (err) {
            console.error('Question generation failed:', err);
            res.status(500).json({ 
                status: 'error', 
                message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
            });
        }
    });

    return app;
};

module.exports = { 
    S3Utils,
    handler: async (event, context) => {
        try {
            console.log('Lambda function invoked:', { event });
            await main();
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Successfully generated and stored trivia questions' })
            };
        } catch (error) {
            console.error('Error in Lambda handler:', error);
            throw error;
        }
    },
    createApp,
    generateQuestions
};

// Initialize S3Utils
const s3Utils = new S3Utils();

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({ 
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Utility function for delay between retries
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Add utility function for retry logic
async function withRetry(operation, maxRetries = 3, delayMs = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            console.error(`Attempt ${i + 1}/${maxRetries} failed:`, error);
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
            }
        }
    }
    throw lastError;
}

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

// Add OAuth configuration
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USER_AGENT = 'TriviaBot/1.0';

async function getRedditAccessToken() {
    try {
        console.log('Attempting to get Reddit access token...');
        const authString = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
        
        const response = await axios.post(
            'https://www.reddit.com/api/v1/access_token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': REDDIT_USER_AGENT
                }
            }
        );

        console.log('Successfully got access token');
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting Reddit access token:', error.response?.data || error.message);
        return null;
    }
}

async function fetchRedditTrends() {
    try {
        console.log('Fetching Reddit trends...');
        const accessToken = await getRedditAccessToken();
        if (!accessToken) {
            console.error('Failed to get Reddit access token, using default topics');
            return defaultTopics;
        }

        const response = await axios.get('https://oauth.reddit.com/r/all/top.json?limit=100&t=week', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': REDDIT_USER_AGENT
            },
            timeout: 5000
        });
        

        if (!response.data || !response.data.data || !response.data.data.children) {
            console.error('Invalid response format from Reddit');
            return defaultTopics;
        }

        const posts = response.data.data.children
            .filter(post => !post.data.over_18 && !post.data.spoiler)
            .map(post => ({
                title: post.data.title,
                subreddit: post.data.subreddit,
                url: post.data.url,
                score: post.data.score
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        if (posts.length === 0) {
            console.warn('No suitable posts found, using default topics');
            return defaultTopics;
        }

        console.log(`Found ${posts.length} trending topics:`, posts.map(p => p.title));
        return posts;
    } catch (error) {
        console.error('Error fetching Reddit trends:', error.response?.data || error.message);
        return defaultTopics;
    }
}

const defaultTopics = [
    {
        title: "The history of the Internet",
        subreddit: "technology"
    },
    {
        title: "Famous scientists and their discoveries",
        subreddit: "science"
    },
    {
        title: "World capitals and geography",
        subreddit: "geography"
    },
    {
        title: "Classic literature and authors",
        subreddit: "books"
    }
];

// Function to sanitize DALL-E prompt
function sanitizeDallEPrompt(prompt) {
    // Remove potentially problematic terms
    const sanitized = prompt
        .replace(/[^\w\s.,!?-]/g, '')
        .replace(/attack|vicious|murder|kill|blood|death|gore|violent|weapon/gi, '')
        .replace(/hitler|nazi|war|military/gi, '')
        .replace(/nsfw|explicit|nude|naked/gi, '')
        .trim();
    
    // Add safety prefixes for certain types of content
    return `A safe, family-friendly illustration of ${sanitized}`;
}

// Function to generate image with retries
async function generateDallEImage(prompt, maxRetries = 3) {
    console.log('Attempting to generate image with DALL-E:', prompt);
    
    // First try DALL-E
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await withRateLimit(async () => {
                return await openai.images.generate({
                    model: "dall-e-3",
                    prompt: sanitizeDallEPrompt(prompt),
                    n: 1,
                    size: "1024x1024",
                    quality: "standard",
                    style: "vivid"
                });
            });

            if (response?.data?.[0]?.url) {
                console.log('Successfully generated image with DALL-E');
                return response.data[0].url;
            }
        } catch (error) {
            console.error(`DALL-E attempt ${attempt + 1} failed:`, error.message);
            
            if (attempt === maxRetries - 1) {
                console.log('All DALL-E attempts failed, trying Bedrock as fallback');
                return await generateImageWithBedrock(prompt);
            }
            
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * Math.pow(2, attempt)));
        }
    }
    
    // If we get here, try Bedrock as fallback
    return await generateImageWithBedrock(prompt);
}

async function generateImageWithBedrock(prompt) {
    console.log('Attempting to generate image with Bedrock SDXL:', prompt);
    
    try {
        const command = new InvokeModelCommand({
            modelId: 'stability.stable-diffusion-xl',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                text_prompts: [{ text: prompt }],
                cfg_scale: 7,
                steps: 30,
                seed: Math.floor(Math.random() * 4294967295)
            })
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        if (!responseBody.artifacts?.[0]?.base64) {
            throw new Error('No image data in Bedrock response');
        }

        return await processAndStoreImage(responseBody.artifacts[0].base64);
    } catch (error) {
        console.error('Bedrock image generation failed:', error);
        return null;
    }
}

async function processAndStoreImage(base64Image) {
    try {
        const s3Utils = new S3Utils();
        const imageBuffer = Buffer.from(base64Image, 'base64');
        const imageKey = `hints/${uuidv4()}.png`;
        
        await s3Utils.s3.send(new PutObjectCommand({
            Bucket: s3Utils.bucketName,
            Key: imageKey,
            Body: imageBuffer,
            ContentType: 'image/png'
        }));

        return await s3Utils.getSignedUrl(imageKey);
    } catch (error) {
        console.error('Failed to process and store image:', error);
        throw error;
    }
}

// Function to create a visual hint prompt
function createVisualHintPrompt(question, answer) {
    const concepts = extractKeyConcepts(question, answer);
    const theme = getThemeFromConcepts(concepts);
    
    const prompt = `Create an educational illustration for a trivia question about ${theme}. 
The image should be:
- Detailed and professional, using a modern design style
- Clear and focused, with strong visual hierarchy
- Educational and engaging
- Suitable for all ages

Include these key elements: ${concepts.join(', ')}

Art direction:
- Use a modern, clean art style with clear shapes and bold colors
- Include subtle educational symbolism
- Maintain professional quality with attention to detail
- Create a composition that draws attention to the key elements
- Use lighting and perspective to create visual interest

Style: Professional digital illustration with attention to detail and educational clarity.`;

    return prompt;
}

function getThemeFromConcepts(concepts) {
    // Join concepts but remove any dates or numbers
    return concepts
        .filter(concept => !concept.match(/^\d+$/))
        .join(' and ');
}

function extractKeyConcepts(question, answer) {
    // Remove common question words and punctuation
    const cleanQuestion = question.toLowerCase()
        .replace(/what|who|where|when|why|how|which|is|are|was|were|did|do|does|has|have|had|\?|\.|\!|\,/g, '')
        .trim();
    
    // Get words from both question and answer
    const questionWords = cleanQuestion.split(' ');
    const answerWords = answer.toLowerCase().split(' ');
    
    // Common words to filter out
    const commonWords = new Set([
        'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'and', 'or', 'but', 'so', 'because', 'if', 'when', 'where', 'how',
        'what', 'why', 'which', 'who', 'whom', 'whose', 'this', 'that', 'these',
        'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
        'should', 'may', 'might', 'must', 'can', 'could'
    ]);

    // Score words based on their importance
    const wordScores = new Map();
    
    // Process question words
    questionWords.forEach(word => {
        if (word.length > 2 && !commonWords.has(word)) {
            wordScores.set(word, (wordScores.get(word) || 0) + 1);
        }
    });
    
    // Answer words are more important
    answerWords.forEach(word => {
        if (word.length > 2 && !commonWords.has(word)) {
            wordScores.set(word, (wordScores.get(word) || 0) + 2);
        }
    });
    
    // Sort by score and get top concepts
    const sortedConcepts = Array.from(wordScores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([word]) => word)
        .filter(word => !word.match(/^\d+$/))  // Filter out pure numbers
        .slice(0, 4);  // Get top 4 concepts
    
    return sortedConcepts;
}

async function generateQuestion(topic) {
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        console.log('Generating question for topic:', topic.title);

        const completion = await withRetry(async () => {
            return await openai.chat.completions.create({
                model: "gpt-4",
                messages: [{
                    role: "system",
                    content: QUESTION_GENERATION_PROMPT
                }, {
                    role: "user",
                    content: `Generate a trivia question about: ${topic.title}`
                }],
                temperature: 0.7,
                max_tokens: 500
            });
        });

        const responseContent = completion.choices[0].message.content;
        console.log('Raw OpenAI response:', responseContent);
        
        let rawQuestionData;
        try {
            rawQuestionData = JSON.parse(responseContent);
            console.log('Parsed question data:', JSON.stringify(rawQuestionData, null, 2));
        } catch (parseError) {
            console.error('Failed to parse OpenAI response:', parseError);
            throw new Error('Invalid JSON format in OpenAI response');
        }

        // Basic structure validation
        if (!rawQuestionData || typeof rawQuestionData !== 'object') {
            console.error('Question data is not a valid object');
            throw new Error('Invalid response structure');
        }

        // Validate required fields in raw data
        const requiredRawFields = ['question', 'correct_answer', 'incorrect_answers'];
        for (const field of requiredRawFields) {
            if (!rawQuestionData[field]) {
                console.error(`Missing required field in raw data: ${field}`);
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Generate and upload image hint if enabled
        let s3ImageUrl = null;
        if (CONFIG.GENERATE_IMAGE_HINTS) {
            try {
                const visualHintPrompt = createVisualHintPrompt(
                    rawQuestionData.question,
                    rawQuestionData.correct_answer
                );
                console.log('Generating image hint with prompt:', visualHintPrompt);
                
                const dallEImageUrl = await generateDallEImage(visualHintPrompt);
                if (dallEImageUrl) {
                    // Initialize S3Utils if not already done
                    const s3Utils = new S3Utils();
                    
                    // Upload the DALL-E image to S3
                    console.log('Uploading DALL-E image to S3:', dallEImageUrl);
                    const s3Key = await s3Utils.uploadFromUrl(dallEImageUrl, 'hints');
                    
                    // Generate a signed URL that expires in 7 days
                    s3ImageUrl = await s3Utils.getSignedUrl(s3Key, 7 * 24 * 60 * 60);
                    console.log('Generated signed S3 URL:', s3ImageUrl);
                }
            } catch (error) {
                console.error('Failed to generate or upload image hint:', error);
                // Continue without image hint if there's an error
            }
        }

        // Create the processed question with all required fields
        const processedQuestion = {
            question: rawQuestionData.question,
            options: [
                rawQuestionData.correct_answer,
                ...rawQuestionData.incorrect_answers
            ],
            correct_answer: 0,
            incorrect_answers: rawQuestionData.incorrect_answers,
            explanation: rawQuestionData.explanation || 'No explanation provided',
            hint: rawQuestionData.hint || 'No hint available',
            hint_image_url: s3ImageUrl || '',
            category: mapSubredditToCategory(topic.subreddit),
            difficulty: rawQuestionData.difficulty || 'Medium'
        };

        // Validate the processed question
        if (!processedQuestion.question || typeof processedQuestion.question !== 'string') {
            throw new Error('Invalid question format');
        }

        if (!Array.isArray(processedQuestion.options) || processedQuestion.options.length !== 4) {
            throw new Error('Invalid options format');
        }

        if (typeof processedQuestion.correct_answer !== 'number' || processedQuestion.correct_answer !== 0) {
            throw new Error('Invalid correct_answer format');
        }

        if (!processedQuestion.explanation || typeof processedQuestion.explanation !== 'string') {
            throw new Error('Invalid explanation format');
        }

        if (!processedQuestion.hint || typeof processedQuestion.hint !== 'string') {
            throw new Error('Invalid hint format');
        }

        console.log('Processed question:', JSON.stringify(processedQuestion, null, 2));
        return processedQuestion;

    } catch (error) {
        console.error('Error generating question:', error);
        throw error;
    }
}

async function saveQuestionToDb(client, question) {
    console.log('Saving question to database:', JSON.stringify(question, null, 2));
    const query = `
        INSERT INTO public.trivia_questions 
        (question, options, correct_answer, explanation, text_hint, image_hint, category, difficulty) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`;
    
    const values = [
        question.question,
        question.options,
        question.correct_answer,
        question.explanation,
        question.hint,
        question.hint_image_url || '',
        question.category,
        question.difficulty
    ];

    try {
        console.log('Executing query with values:', values);
        const result = await client.query(query, values);
        console.log(`Successfully inserted question with ID: ${result.rows[0].id}`);
        return result.rows[0].id;
    } catch (error) {
        console.error('Error saving question to database:', error);
        throw error;
    }
}

const QUESTION_GENERATION_PROMPT = `Create a challenging and thought-provoking trivia question.

REQUIRED fields (must be included):
- question: the trivia question (make it challenging, specific, and educational)
- correct_answer: the FULL TEXT of the correct answer as a string
- incorrect_answers: array of EXACTLY 3 plausible but incorrect answers as strings
- explanation: brief explanation of why the correct answer is right
- hint: a subtle hint that requires critical thinking

Example response format:
{
    "question": "What popular media player software, released in 2001, is known for its cone-shaped traffic icon?",
    "correct_answer": "VLC Media Player",
    "incorrect_answers": [
        "Windows Media Player",
        "QuickTime Player",
        "Winamp"
    ],
    "explanation": "VLC Media Player, released by VideoLAN in 2001, uses a traffic cone as its icon because students at École Centrale Paris collected traffic cones after parties.",
    "hint": "Think about a common road safety object that became an iconic symbol.",
    "difficulty": "Medium"
}

Guidelines:
1. Focus on specific details rather than general knowledge
2. Include numerical data, dates, or technical terms when relevant
3. Make incorrect answers very plausible and related to the topic
4. Create answers that require understanding rather than memorization
5. ALWAYS include both an explanation and a hint

Important: ALL answers must be provided as complete, readable strings. The system will automatically handle the answer positioning.`;

async function validateProcessedQuestion(question) {
    try {
        // Check for null/undefined
        if (!question) {
            return { isValid: false, error: 'Question data is null or undefined' };
        }

        // Required fields (explanation is not required)
        const requiredFields = ['question', 'correct_answer', 'incorrect_answers', 'options'];
        for (const field of requiredFields) {
            if (question[field] === undefined || question[field] === null) {
                return { isValid: false, error: `Missing required field: ${field}` };
            }
        }

        // Validate question text
        if (typeof question.question !== 'string' || 
            question.question.length < 10 || 
            question.question.length > 500) {
            return { isValid: false, error: 'Invalid question format or length' };
        }

        // Validate correct_answer is 0
        if (question.correct_answer !== 0) {
            return { isValid: false, error: 'correct_answer must be 0' };
        }

        // Validate incorrect_answers
        if (!Array.isArray(question.incorrect_answers) || 
            question.incorrect_answers.length !== 3 ||
            !question.incorrect_answers.every(ans => typeof ans === 'string')) {
            return { isValid: false, error: 'Invalid incorrect_answers format' };
        }

        // Validate options array
        if (!Array.isArray(question.options) || 
            question.options.length !== 4 ||
            !question.options.every(opt => typeof opt === 'string')) {
            return { isValid: false, error: 'Invalid options format' };
        }

        // Set default values for optional fields
        if (!question.explanation || typeof question.explanation !== 'string') {
            question.explanation = 'None';
        }

        if (!question.hint || typeof question.hint !== 'string') {
            question.hint = null;
        }

        if (!question.hint_image_url || typeof question.hint_image_url !== 'string') {
            question.hint_image_url = null;
        }

        // Validate difficulty
        const validDifficulties = ['Easy', 'Medium', 'Hard'];
        if (!validDifficulties.includes(question.difficulty)) {
            question.difficulty = 'Medium';
        }

        return { isValid: true, error: null };
    } catch (error) {
        return { isValid: false, error: `Validation error: ${error.message}` };
    }
}

function mapSubredditToCategory(subreddit) {
    const categoryMap = {
        'science': 'Science',
        'history': 'History',
        'space': 'Space',
        'technology': 'Technology',
        'tech': 'Technology',
        'worldnews': 'Current Events',
        'news': 'Current Events',
        'politics': 'Politics',
        'sports': 'Sports',
        'gaming': 'Gaming',
        'movies': 'Entertainment',
        'television': 'Entertainment',
        'music': 'Entertainment',
        'books': 'Literature',
        'art': 'Arts',
        'food': 'Food & Drink',
        'travel': 'Geography',
        'explainlikeimfive': 'Science',
        'todayilearned': 'General Knowledge',
        'MadeMeSmile': 'Society',
        'UpliftingNews': 'Current Events',
        'Futurology': 'Technology'
    };
    
    return categoryMap[subreddit.toLowerCase()] || 'General Knowledge';
}

async function isDuplicateQuestion(client, question) {
    const result = await client.query(
        'SELECT COUNT(*) FROM public.trivia_questions WHERE question = $1',
        [question.question]
    );
    return result.rows[0].count > 0;
}

async function saveToDatabase(questions) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        for (const q of questions) {
            // Combine correct answer with incorrect answers to form options array
            const options = [
                ...q.incorrect_answers.slice(0, q.correct_answer),
                q.correct_answer,
                ...q.incorrect_answers.slice(q.correct_answer)
            ];

            const query = `
                INSERT INTO trivia_questions 
                (question, options, correct_answer, explanation, text_hint, image_hint, category, difficulty) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id`;
            
            const values = [
                q.question,
                options,
                q.correct_answer,
                'Generated by AI',
                q.hint || 'No hint available',
                q.hint_image_url || null,
                q.category || 'General',
                q.difficulty || 'Medium'
            ];

            await client.query(query, values);
        }
        
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function generateQuestions(topics = []) {
    let client;
    try {
        // Get client from the existing pool if not in test mode
        if (!process.env.TEST_REDDIT && pool) {
            client = await pool.connect();
        }
        console.log('Starting trivia question generation process...');
        
        // Ensure topics is an array and has items
        if (!Array.isArray(topics) || topics.length === 0) {
            console.log('No topics provided, fetching from Reddit...');
            topics = await fetchRedditTrends();
            if (!topics || topics.length === 0) {
                console.log('No trending topics found, using default topics');
                topics = defaultTopics;
            }
        }
        
        // If in test mode, just return the topics
        if (process.env.TEST_REDDIT) {
            return topics;
        }
        
        // Process questions
        const questions = [];
        for (const topic of topics.slice(0, CONFIG.QUESTIONS_PER_DAY)) {
            try {
                console.log('Processing topic:', topic);
                const question = await generateQuestion(topic);
                if (question && client) {
                    // Check for duplicate before adding
                    const isDuplicate = await isDuplicateQuestion(client, question);
                    if (!isDuplicate) {
                        questions.push(question);
                        console.log('Successfully generated question for:', topic.title);
                    } else {
                        console.log('Duplicate question found, skipping:', topic.title);
                    }
                }
            } catch (error) {
                console.error(`Failed to generate question for topic: ${JSON.stringify(topic)}`, error);
            }
        }
        
        // Save questions in transaction if not in test mode
        if (!process.env.TEST_REDDIT && questions.length > 0 && client) {
            await client.query('BEGIN');
            try {
                for (const question of questions) {
                    await saveQuestionToDb(client, question);
                }
                await client.query('COMMIT');
                console.log(`Successfully saved ${questions.length} questions to database`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        }
        
        return questions;
    } catch (error) {
        console.error('Error in question generation process:', error);
        throw error;
    } finally {
        if (client) {
            client.release();
        }
    }
}

async function startServer() {
    try {
        validateEnvironment();
        
        // Get trending topics
        const topics = await fetchRedditTrends();
        if (!topics || topics.length === 0) {
            console.log('No trending topics found');
            return;
        }
        
        // Generate questions
        const questions = await generateQuestions(topics);
        console.log(`Generated ${questions.length} questions`);
        
        // Schedule next run
        const currentTime = new Date();
        // Get time in Arizona timezone
        const azTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'America/Phoenix' }));
        
        // Create a new date for the next midnight in Arizona
        const nextMidnight = new Date(azTime);
        nextMidnight.setDate(nextMidnight.getDate() + 1);
        nextMidnight.setHours(0, 0, 0, 0);
        
        // Calculate minutes until next midnight
        const nextRunMinutes = Math.floor((nextMidnight - currentTime) / (1000 * 60));
        
        console.log(`Scheduling next question generation in ${nextRunMinutes} minutes (until midnight Arizona time)`);
        // Schedule next run of the server after the calculated number of minutes until next midnight
        setTimeout(() => startServer(), (Math.abs(nextRunMinutes-420)) * 60 * 1000);
        
    } catch (error) {
        console.error('Error starting server:', error);
        // Schedule retry in case of error
        console.log('Scheduling retry in 15 minutes');
        setTimeout(() => startServer(), 15 * 60 * 1000);
    }
}

async function main() {
    let exitCode = 0;
    try {
        console.log('Starting trivia question generation process...');
        
        // Validate environment
        validateEnvironment();
        
        // Initialize database
        const pool = new Pool(getDatabaseConfig());

        // Test database connection on startup
        pool.connect()
            .then(client => {
                console.log('Successfully connected to PostgreSQL');
                client.release();
            })
            .catch(err => {
                console.error('Error connecting to PostgreSQL:', err);
                // Don't exit, let the service retry connections
            });

        // Get trending topics
        const topics = await fetchRedditTrends();
        if (!topics || topics.length === 0) {
            console.log('No trending topics found. Exiting...');
            process.exit(0);
        }

        console.log('Attempting to generate questions...');
        const questionsToGenerate = Math.min(2, topics.length);
        const questions = [];

        for (let i = 0; i < questionsToGenerate; i++) {
            const topic = topics[i];
            console.log(`\nProcessing topic ${i + 1}/${questionsToGenerate}: "${topic.title}" from r/${topic.subreddit}`);
            
            try {
                const question = await generateQuestion(topic);
                if (question) {
                    questions.push(question);
                    console.log(`✓ Successfully generated question ${i + 1}/${questionsToGenerate}`);
                }
            } catch (error) {
                console.error(`X Failed to generate question for topic: ${topic.title}`, error);
            }
        }

        // Save questions to database
        if (questions.length > 0) {
            await saveToDatabase(questions);
            console.log(`Successfully generated and saved ${questions.length} questions`);
        } else {
            console.log('No questions were generated successfully');
            exitCode = 1;
        }
        
        // Don't exit after generating questions in server mode
        if (process.env.NODE_ENV !== 'development') {
            console.log('Question generation completed. Service remains running.');
        } else {
            console.log('Question generation completed. Exiting in development mode...');
            await pool.end();
            process.exit(0);
        }
    } catch (error) {
        console.error('Error in question generation process:', error);
        if (process.env.NODE_ENV === 'development') {
            process.exit(1);
        }
    }
}

// If this file is run directly, execute the question generation
if (require.main === module) {
    generateQuestions().catch(error => {
        console.error('Error running question generation:', error);
        process.exit(1);
    });
}

async function testRedditIntegration() {
    try {
        console.log('Testing Reddit API integration...');
        const topics = await fetchRedditTrends();
        console.log('Fetched topics:', topics);
        process.exit(0);
    } catch (error) {
        console.error('Error testing Reddit integration:', error);
        process.exit(1);
    }
}

// If this file is run directly with TEST_REDDIT env var, run the test
if (require.main === module && process.env.TEST_REDDIT) {
    testRedditIntegration();
} else if (require.main === module) {
    generateQuestions().catch(error => {
        console.error('Error running question generation:', error);
        process.exit(1);
    });
}
