import logger from './logger-service.js';
import { mockQuestions } from './mock-questions.js';

// Use relative URLs since we're proxying through nginx
const QUESTIONS_API_URL = '/api/questions';
const LEADERBOARD_API_URL = '/api/leaderboard';

class ApiService {
    constructor() {
        console.log('=== Initializing API Service ===');
        this.initialized = false;
        this.initializationAttempts = 0;
        this.maxInitAttempts = 5;
        
        // Use relative URLs for all API endpoints
        this.questionsApiUrl = QUESTIONS_API_URL;
        
        // Use relative URLs for leaderboard
        this.leaderboardApiUrl = LEADERBOARD_API_URL;
        this.leaderboardSubmitUrl = `${LEADERBOARD_API_URL}/submit-score`;
        
        this.apiKey = '';
        this.leaderboardApiKey = '';
        
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.questionsPerGame = 6;

        console.log('=== API Service Configuration ===', {
            questionsApiUrl: this.questionsApiUrl,
            leaderboardApiUrl: this.leaderboardApiUrl,
            hasApiKey: !!this.apiKey,
            hasLeaderboardKey: !!this.leaderboardApiKey,
            cacheTimeout: this.cacheTimeout,
            questionsPerGame: this.questionsPerGame
        });

        // Try to initialize immediately
        this.initialize();

        // Validate mock questions are available
        if (!Array.isArray(mockQuestions) || mockQuestions.length === 0) {
            console.error('=== Mock Questions Error ===', {
                isMockArray: Array.isArray(mockQuestions),
                mockLength: mockQuestions?.length
            });
            throw new Error('Mock questions configuration error');
        }
        console.log(`=== Loaded ${mockQuestions.length} mock questions as fallback ===`);
    }

    async initialize() {
        console.log(`=== Initialize Attempt ${this.initializationAttempts + 1}/${this.maxInitAttempts} ===`);
        
        try {
            // Simple health check - just try to get questions
            const response = await fetch(this.questionsApiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/json'
                }
            });

            console.log('=== Health Check Response ===', {
                status: response.status,
                ok: response.ok,
                headers: Object.fromEntries([...response.headers])
            });

            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }

            // Try to parse the response to verify it's valid JSON
            try {
                const data = await response.json();
                console.log('=== Health Check Data ===', {
                    isArray: Array.isArray(data),
                    length: data?.length,
                    firstItem: data?.[0]
                });
            } catch (e) {
                console.error('=== Health Check Parse Error ===', {
                    error: e.message,
                    type: e.constructor.name
                });
                throw new Error('Health check failed: Invalid JSON response');
            }

            this.initialized = true;
            console.log('=== API Service Initialized Successfully ===');
            return true;
        } catch (error) {
            console.error('=== Initialization Failed ===', {
                attempt: this.initializationAttempts + 1,
                error: error.message,
                stack: error.stack
            });

            this.initializationAttempts++;
            if (this.initializationAttempts < this.maxInitAttempts) {
                // Retry with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, this.initializationAttempts), 10000);
                console.log(`=== Retrying in ${delay}ms ===`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.initialize();
            } else {
                console.error('=== Max Initialization Attempts Reached ===');
                return false;
            }
        }
    }

    async makeRequest(endpoint, method = 'GET', body = null, useLeaderboardKey = false, options = {}) {
        // Special handling for leaderboard endpoints
        if (useLeaderboardKey) {
            // Ensure we're using the correct full URL for leaderboard
            let fullUrl;
            if (options.useFullUrl) {
                fullUrl = endpoint;
            } else {
                fullUrl = this.leaderboardApiUrl;
            }
            
            console.log('=== Leaderboard Request Configuration ===', {
                baseUrl: this.leaderboardApiUrl,
                endpoint,
                fullUrl,
                method,
                useLeaderboardKey,
                body
            });

            return this._makeRequestWithRetry(fullUrl, method, body, useLeaderboardKey);
        }

        // Existing logic for other API endpoints
        const baseUrl = this.questionsApiUrl;
        
        // Ensure clean endpoint without duplicate segments
        const cleanEndpoint = endpoint 
            ? `/${endpoint.replace(/^\/+/, '').replace(/\/api\/questions\/api\/questions$/, '')}`
            : '';
        
        const fullUrl = `${baseUrl}${cleanEndpoint}`;

        console.log('=== API Request Configuration ===', {
            baseUrl,
            endpoint,
            cleanEndpoint,
            url: fullUrl,
            method,
            useLeaderboardKey
        });

        return this._makeRequestWithRetry(fullUrl, method, body, useLeaderboardKey);
    }

    async _makeRequestWithRetry(fullUrl, method, body = null, useLeaderboardKey = false, maxRetries = 3) {
        const apiKey = useLeaderboardKey ? this.leaderboardApiKey : this.apiKey;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(apiKey ? { 'X-Api-Key': apiKey } : {})
                };

                // Log request details before sending
                console.log(`=== Request Attempt ${attempt}/${maxRetries} ===`, {
                    url: fullUrl,
                    method,
                    headers: { ...headers, 'X-Api-Key': apiKey ? '***' : undefined },
                    bodyPreview: body ? JSON.stringify(body).slice(0, 100) : null,
                    bodyType: body ? typeof body : null,
                    timestamp: new Date().toISOString()
                });
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

                const response = await fetch(fullUrl, {
                    method,
                    headers,
                    ...(body ? { body: JSON.stringify(body) } : {}),
                    signal: controller.signal,
                    mode: 'cors',
                    credentials: 'include'
                });

                clearTimeout(timeoutId);

                // Log raw response details
                console.log(`=== Raw Response (Attempt ${attempt}) ===`, {
                    status: response.status,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries()),
                    type: response.type,
                    url: response.url,
                    timestamp: new Date().toISOString()
                });

                // Handle 500 errors specifically
                if (response.status === 500) {
                    let errorData;
                    try {
                        const text = await response.text();
                        console.log(`=== Server Error Details (Attempt ${attempt}) ===`, {
                            text,
                            timestamp: new Date().toISOString()
                        });
                        
                        try {
                            errorData = JSON.parse(text);
                        } catch {
                            errorData = { error: 'Unknown server error', message: text };
                        }
                        
                        // If this is a server error, don't retry
                        throw new Error('Server error: ' + (errorData.message || 'Unknown error'));
                    } catch (parseError) {
                        console.error(`=== Error Parsing Server Error (Attempt ${attempt}) ===`, {
                            parseError: parseError.message,
                            timestamp: new Date().toISOString()
                        });
                        throw new Error('Failed to parse server error');
                    }
                }

                // Check content type and log it
                const contentType = response.headers.get('content-type');
                const isJson = contentType && contentType.includes('application/json');
                
                console.log(`=== Response Content Type (Attempt ${attempt}) ===`, {
                    contentType,
                    isJson,
                    timestamp: new Date().toISOString()
                });

                // Handle non-OK responses
                if (!response.ok) {
                    let errorBody = null;
                    let responseText = null;
                    
                    try {
                        // Try to get the raw text first
                        responseText = await response.text();
                        console.log(`=== Error Response Text (Attempt ${attempt}) ===`, {
                            responseText,
                            length: responseText.length,
                            timestamp: new Date().toISOString()
                        });
                        
                        // Then try to parse as JSON if it looks like JSON
                        if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
                            errorBody = JSON.parse(responseText);
                        }
                    } catch (parseError) {
                        console.warn(`=== Response Parse Error (Attempt ${attempt}) ===`, {
                            parseError: parseError.message,
                            responseText,
                            timestamp: new Date().toISOString()
                        });
                    }

                    // Log detailed error information
                    console.error(`=== HTTP Error (Attempt ${attempt}) ===`, {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorBody,
                        rawResponse: responseText,
                        requestedUrl: fullUrl,
                        timestamp: new Date().toISOString()
                    });

                    // Don't retry server errors
                    if (response.status >= 500) {
                        throw new Error('Server error - please try again later');
                    }

                    // Construct detailed error message
                    const errorMessage = errorBody 
                        ? (typeof errorBody === 'object' 
                            ? JSON.stringify(errorBody) 
                            : errorBody)
                        : responseText || `HTTP Error ${response.status} (${response.statusText})`;

                    throw new Error(errorMessage);
                }

                // Parse successful response
                let responseData;
                let responseText;
                
                try {
                    // Get raw text first
                    responseText = await response.text();
                    console.log(`=== Response Text (Attempt ${attempt}) ===`, {
                        text: responseText.slice(0, 200), // Log first 200 chars
                        length: responseText.length,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Parse as JSON if it's JSON content type
                    if (isJson && responseText) {
                        responseData = JSON.parse(responseText);
                    } else {
                        responseData = responseText;
                    }
                    
                    console.log(`=== Parsed Response (Attempt ${attempt}) ===`, {
                        dataType: typeof responseData,
                        isArray: Array.isArray(responseData),
                        preview: typeof responseData === 'object' ? 
                            JSON.stringify(responseData).slice(0, 200) : 
                            String(responseData).slice(0, 200),
                        timestamp: new Date().toISOString()
                    });
                    
                } catch (parseError) {
                    console.error(`=== Response Parse Error (Attempt ${attempt}) ===`, {
                        error: parseError.message,
                        responseText,
                        timestamp: new Date().toISOString()
                    });
                    throw new Error(`Failed to parse response: ${parseError.message}`);
                }

                return responseData;

            } catch (error) {
                // Log detailed error information
                console.error(`=== Request Failed (Attempt ${attempt}) ===`, {
                    error: error.message,
                    name: error.name,
                    stack: error.stack,
                    type: error.constructor.name,
                    url: fullUrl,
                    method,
                    timestamp: new Date().toISOString()
                });

                // Don't retry server errors
                if (error.message.startsWith('Server error:')) {
                    throw error;
                }

                // Handle specific error types
                if (error.name === 'AbortError') {
                    console.warn(`=== Request Timeout (Attempt ${attempt}) ===`, {
                        timeout: 10000,
                        timestamp: new Date().toISOString()
                    });
                }

                // Don't retry on certain errors
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    console.error(`=== Network Error (Attempt ${attempt}) ===`, {
                        message: 'Network connectivity issue detected',
                        timestamp: new Date().toISOString()
                    });
                    throw error;
                }

                // Last attempt
                if (attempt === maxRetries) {
                    throw new Error(`Failed to complete request after ${maxRetries} attempts: ${error.message}`);
                }

                // Wait before retrying (exponential backoff)
                const retryDelay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`=== Retrying Request ===`, {
                    attempt,
                    nextAttemptIn: retryDelay,
                    timestamp: new Date().toISOString()
                });
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    async getQuestions() {
        console.log('=== Starting API Request ===');
        try {
            // Directly use the base questions API URL without any additional endpoint
            const response = await this.makeRequest('');
            
            console.log('=== Raw API Response ===', {
                type: typeof response,
                isArray: Array.isArray(response),
                response
            });

            // Validate and transform the response
            let questions;
            if (Array.isArray(response)) {
                questions = response;
            } else if (response && typeof response === 'object') {
                // Check for different possible keys that might contain questions
                const possibleQuestionKeys = ['questions', 'data', 'items', 'results'];
                
                for (let key of possibleQuestionKeys) {
                    if (response[key] && Array.isArray(response[key])) {
                        questions = response[key];
                        break;
                    }
                }

                // If no array found, try to convert the object to an array
                if (!questions) {
                    questions = Object.values(response).filter(item => 
                        typeof item === 'object' && 
                        item !== null && 
                        typeof item.question === 'string'
                    );
                }
            }

            // If still no questions, throw an error
            if (!questions || questions.length === 0) {
                console.warn('=== Invalid Response Format ===', {
                    response,
                    type: typeof response
                });
                throw new Error('Invalid response format: no questions found');
            }

            // Validate questions
            const validQuestions = questions.filter(q => {
                const validation = {
                    isObject: typeof q === 'object' && q !== null,
                    hasQuestion: typeof q?.question === 'string',
                    hasOptions: Array.isArray(q?.options) && q?.options?.length === 4,
                    hasCorrectAnswer: typeof q?.correct_answer === 'number' && q?.correct_answer >= 0 && q?.correct_answer <= 3,
                    hasId: typeof q?.id === 'number' || typeof q?.id === 'string',
                    hasTextHint: typeof q?.text_hint === 'string',
                    hasImageHint: !q?.image_hint || typeof q?.image_hint === 'string',
                    hasExplanation: typeof q?.explanation === 'string'
                };
                
                console.log('=== Question Validation ===', {
                    question: q?.question,
                    validation
                });
                
                return Object.values(validation).every(v => v === true);
            });

            console.log('=== Get Questions Response ===', {
                totalQuestions: questions.length,
                validQuestions: validQuestions.length
            });

            // If no valid questions, fall back to mock data
            if (validQuestions.length === 0) {
                console.warn('=== No Valid Questions ===');
                return this.getMockQuestions();
            }

            // Select a subset of questions if needed
            return this.selectRandomQuestions(validQuestions);
        } catch (error) {
            console.error('=== Get Questions Failed ===', {
                error: error.message,
                stack: error.stack,
                responseType: typeof response,
                response
            });
            
            // Fallback to mock data if API request fails
            const mockQuestions = this.getMockQuestions();
            
            console.warn(`Failed to fetch questions from API, falling back to mock data: ${error.message}`);
            
            return mockQuestions;
        }
    }

    async submitScore(scoreData) {
        try {
            const { username, score } = scoreData;

            // Validate score data
            if (!username || typeof username !== 'string') {
                console.warn('=== Invalid Username ===', {
                    username,
                    type: typeof username,
                    timestamp: new Date().toISOString()
                });
                throw new Error('Invalid username');
            }

            if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
                console.warn('=== Invalid Score ===', {
                    message: 'Negative score',
                    score: score,
                    timestamp: new Date().toISOString()
                });
                throw new Error('Score must be a non-negative integer');
            }

            // Clean the username and prepare data
            const cleanedData = {
                username: username.trim(),
                score: score
            };

            console.log('=== Preparing Score Submission ===', {
                ...cleanedData,
                timestamp: new Date().toISOString()
            });

            // Log detailed request information
            console.log('=== Score Submission Request Details ===', {
                url: this.leaderboardSubmitUrl,
                method: 'POST',
                data: cleanedData,
                timestamp: new Date().toISOString()
            });

            // Use the submit-score endpoint for POSTing scores
            const data = await this.makeRequest(
                this.leaderboardSubmitUrl,
                'POST',
                cleanedData,
                true,
                { useFullUrl: true }
            );
            
            console.log('=== Score Submission Response ===', {
                success: true,
                responseData: data,
                timestamp: new Date().toISOString()
            });

            return data;
        } catch (error) {
            // Log detailed error information
            console.error('=== Score Submission Error ===', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                scoreData: {
                    username: scoreData.username,
                    score: scoreData.score
                },
                timestamp: new Date().toISOString()
            });

            // Handle specific error types
            if (error.message.includes('CORS')) {
                console.warn('=== CORS Error Detected ===', {
                    message: 'CORS error submitting score - continuing game',
                    origin: window.location.origin,
                    timestamp: new Date().toISOString()
                });
                return null;
            }

            if (error.message.includes('Internal server error')) {
                console.error('=== Server Error Detected ===', {
                    message: 'Internal server error while submitting score',
                    timestamp: new Date().toISOString()
                });
                // You might want to implement a fallback here
                return null;
            }

            // Rethrow other errors
            throw error;
        }
    }

    async getLeaderboard() {
        try {
            // Explicitly use the full leaderboard API endpoint with origin
            const data = await this.makeRequest(this.leaderboardApiUrl, 'GET', null, true);
            return data;
        } catch (error) {
            // If we get a CORS error, log it but don't throw
            if (error.message && error.message.includes('CORS')) {
                logger.warn('CORS error getting leaderboard - continuing game:', error);
                return [];
            }
            throw error;
        }
    }

    selectRandomQuestions(questions, count = 10) {
        // Shuffle the array
        const shuffled = questions.sort(() => 0.5 - Math.random());
        
        // Return up to 'count' questions
        return shuffled.slice(0, count);
    }

    getMockQuestions() {
        return [
            {
                id: 1,
                question: "Mock Question 1",
                options: ["Option A", "Option B", "Option C", "Option D"],
                correct_answer: 0,
                text_hint: "This is a mock hint",
                explanation: "This is a mock explanation"
            },
            {
                id: 2,
                question: "Mock Question 2",
                options: ["Option A", "Option B", "Option C", "Option D"],
                correct_answer: 1,
                text_hint: "This is another mock hint",
                explanation: "This is another mock explanation"
            }
            // Add more mock questions as needed
        ];
    }
}

const apiService = new ApiService();
export default apiService;
