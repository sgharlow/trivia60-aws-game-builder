const http = require('http');

// Configuration - can be overridden by environment variables
const config = {
    TEST_DURATION: process.env.TEST_DURATION || 60000, // 60 seconds
    CONCURRENT_REQUESTS: process.env.CONCURRENT_REQUESTS || 20,
    REQUEST_DELAY: process.env.REQUEST_DELAY || 100, // Add delay between requests
    BASE_RETRY_DELAY: process.env.BASE_RETRY_DELAY || 1000,
    MAX_RETRIES: process.env.MAX_RETRIES || 3,
    TARGET_HOST: process.env.TARGET_HOST || 'localhost',
    TARGET_PORT: process.env.TARGET_PORT || 4003,
    REQUEST_TIMEOUT: process.env.REQUEST_TIMEOUT || 10000 // 10 seconds timeout
};

// Create a reusable agent for connection pooling
const agent = new http.Agent({
    keepAlive: true,
    maxSockets: config.CONCURRENT_REQUESTS,
    keepAliveMsecs: 1000,
    timeout: config.REQUEST_TIMEOUT,
    scheduling: 'lifo', // Last in first out to reduce concurrent connections
});

// Statistics tracking
let stats = {
    getRequests: {
        successful: 0,
        failed: 0,
        totalResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0
    },
    postRequests: {
        successful: 0,
        failed: 0,
        totalResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0
    },
    activeRequests: 0,
    testStartTime: 0,
    errorCounts: {},
    lastError: null
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate random test data
function generateTestData() {
    const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Henry'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return {
        username: (randomName + '_' + randomNum).slice(0, 50), // Ensure under 50 chars
        score: Math.floor(Math.random() * 1000) // Non-negative integer
    };
}

// Validate leaderboard entry
function validateLeaderboardEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    if (!entry.username || typeof entry.username !== 'string' || entry.username.length > 50) return false;
    if (!Number.isInteger(entry.score) || entry.score < 0) return false;
    if (!entry.created_at) return false;
    return true;
}

// Make GET request to fetch leaderboard
async function makeGetRequest() {
    const startTime = Date.now();
    stats.activeRequests++;

    const options = {
        hostname: config.TARGET_HOST,
        port: config.TARGET_PORT,
        path: '/api/leaderboard',
        method: 'GET',
        timeout: config.REQUEST_TIMEOUT,
        agent: agent,
        headers: {
            'Accept': 'application/json'
        }
    };

    try {
        const response = await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });

        const responseTime = Date.now() - startTime;
        stats.getRequests.successful++;
        stats.getRequests.totalResponseTime += responseTime;
        stats.getRequests.minResponseTime = Math.min(stats.getRequests.minResponseTime, responseTime);
        stats.getRequests.maxResponseTime = Math.max(stats.getRequests.maxResponseTime, responseTime);

        return response;
    } catch (error) {
        stats.getRequests.failed++;
        const errorMessage = error.message || 'Unknown error';
        stats.errorCounts[errorMessage] = (stats.errorCounts[errorMessage] || 0) + 1;
        stats.lastError = error;
        throw error;
    } finally {
        stats.activeRequests--;
    }
}

// Make POST request to submit a score
async function makePostRequest() {
    const startTime = Date.now();
    stats.activeRequests++;

    const testData = generateTestData();
    
    const options = {
        hostname: config.TARGET_HOST,
        port: config.TARGET_PORT,
        path: '/api/leaderboard',
        method: 'POST',
        timeout: config.REQUEST_TIMEOUT,
        agent: agent,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    try {
        const response = await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const parsedData = JSON.parse(data);
                            if (!validateLeaderboardEntry(parsedData)) {
                                reject(new Error('Invalid response format'));
                            } else {
                                resolve({ statusCode: res.statusCode, data: parsedData });
                            }
                        } catch (e) {
                            reject(new Error('Failed to parse response'));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(JSON.stringify(testData));
            req.end();
        });

        const responseTime = Date.now() - startTime;
        stats.postRequests.successful++;
        stats.postRequests.totalResponseTime += responseTime;
        stats.postRequests.minResponseTime = Math.min(stats.postRequests.minResponseTime, responseTime);
        stats.postRequests.maxResponseTime = Math.max(stats.postRequests.maxResponseTime, responseTime);

        return response;
    } catch (error) {
        stats.postRequests.failed++;
        if (!stats.errorCounts[error.message]) {
            stats.errorCounts[error.message] = 0;
        }
        stats.errorCounts[error.message]++;
        stats.lastError = error;
        throw error;
    } finally {
        stats.activeRequests--;
    }
}

async function runLoadTest() {
    console.log(`Starting load test with configuration:
    Host: ${config.TARGET_HOST}
    Port: ${config.TARGET_PORT}
    Duration: ${config.TEST_DURATION}ms
    Concurrent Requests: ${config.CONCURRENT_REQUESTS}
    Request Delay: ${config.REQUEST_DELAY}ms
    Request Timeout: ${config.REQUEST_TIMEOUT}ms
    `);

    // Make a test request before starting the load test
    console.log('Making test requests...');
    try {
        await makeGetRequest();
        await makePostRequest();
        console.log('Test requests successful, starting load test...');
    } catch (error) {
        console.error('Test requests failed:', error);
        process.exit(1);
    }

    stats.testStartTime = Date.now();
    const endTime = stats.testStartTime + config.TEST_DURATION;

    const makeRequest = async () => {
        while (Date.now() < endTime) {
            try {
                // Randomly choose between GET and POST requests
                if (Math.random() < 0.7) { // 70% GET requests
                    await makeGetRequest();
                } else { // 30% POST requests
                    await makePostRequest();
                }
                await sleep(config.REQUEST_DELAY);
            } catch (error) {
                console.error('Request failed:', error.message);
            }
        }
    };

    // Start concurrent requests
    const requests = Array(config.CONCURRENT_REQUESTS)
        .fill()
        .map(() => makeRequest());

    await Promise.all(requests);

    // Calculate and display results
    const testDuration = Date.now() - stats.testStartTime;
    const getAvgResponseTime = stats.getRequests.successful > 0 
        ? stats.getRequests.totalResponseTime / stats.getRequests.successful 
        : 0;
    const postAvgResponseTime = stats.postRequests.successful > 0 
        ? stats.postRequests.totalResponseTime / stats.postRequests.successful 
        : 0;

    console.log('\nLoad Test Results:');
    console.log('GET Requests:');
    console.log(`  Successful: ${stats.getRequests.successful}`);
    console.log(`  Failed: ${stats.getRequests.failed}`);
    console.log(`  Average Response Time: ${getAvgResponseTime.toFixed(2)}ms`);
    console.log(`  Min Response Time: ${stats.getRequests.minResponseTime}ms`);
    console.log(`  Max Response Time: ${stats.getRequests.maxResponseTime}ms`);
    
    console.log('\nPOST Requests:');
    console.log(`  Successful: ${stats.postRequests.successful}`);
    console.log(`  Failed: ${stats.postRequests.failed}`);
    console.log(`  Average Response Time: ${postAvgResponseTime.toFixed(2)}ms`);
    console.log(`  Min Response Time: ${stats.postRequests.minResponseTime}ms`);
    console.log(`  Max Response Time: ${stats.postRequests.maxResponseTime}ms`);

    console.log('\nTotal Test Duration:', testDuration / 1000, 'seconds');
    
    if (Object.keys(stats.errorCounts).length > 0) {
        console.log('\nError Distribution:');
        Object.entries(stats.errorCounts).forEach(([error, count]) => {
            console.log(`${error}: ${count}`);
        });
    }

    // Clean up
    agent.destroy();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    stats.lastError = error;
});

// Run the load test
runLoadTest();
