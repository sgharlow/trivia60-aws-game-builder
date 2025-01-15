const http = require('http');

// Configuration - can be overridden by environment variables
const config = {
    TEST_DURATION: process.env.TEST_DURATION || 60000, // 60 seconds
    CONCURRENT_REQUESTS: process.env.CONCURRENT_REQUESTS || 5, // Reduced from 20
    REQUEST_DELAY: process.env.REQUEST_DELAY || 500, // Increased from 100ms to 500ms
    BASE_RETRY_DELAY: process.env.BASE_RETRY_DELAY || 2000, // Increased from 1000ms
    MAX_RETRIES: process.env.MAX_RETRIES || 5, // Increased from 3
    TARGET_HOST: process.env.TARGET_HOST || 'localhost', // Changed from localhost
    TARGET_PORT: process.env.TARGET_PORT || 4001,
    REQUEST_TIMEOUT: process.env.REQUEST_TIMEOUT || 15000,
    QUESTIONS_LIMIT: process.env.QUESTIONS_LIMIT || 10
};

// Create a reusable agent for connection pooling
const agent = new http.Agent({
    keepAlive: true,
    maxSockets: config.CONCURRENT_REQUESTS,
    keepAliveMsecs: 1000,
    timeout: config.REQUEST_TIMEOUT,
    scheduling: 'lifo', // Last in first out to reduce concurrent connections
});

const options = {
    hostname: config.TARGET_HOST,
    port: config.TARGET_PORT,
    path: encodeURI(`/api/questions?limit=${config.QUESTIONS_LIMIT}`),
    method: 'GET',
    timeout: config.REQUEST_TIMEOUT,
    agent: agent,
    headers: {
        'Connection': 'keep-alive',
        'Accept': 'application/json'
    }
};

// Statistics tracking
let stats = {
    successfulRequests: 0,
    failedRequests: 0,
    totalResponseTime: 0,
    activeRequests: 0,
    testStartTime: 0,
    errorCounts: {},
    minResponseTime: Infinity,
    maxResponseTime: 0,
    lastError: null,
    lastResponse: null,
    lastResponseBody: null,
    lastRequestTime: null,
    lastStatusCode: null
};

// Add detailed error logging
function logError(error, phase) {
    console.error(`\n[${phase}] Error Details:`);
    console.error('- Type:', error.name);
    console.error('- Message:', error.message);
    console.error('- Code:', error.code);
    if (error.syscall) console.error('- Syscall:', error.syscall);
    if (error.address) console.error('- Address:', error.address);
    if (error.port) console.error('- Port:', error.port);
    console.error('- Stack:', error.stack);
    console.error('\n');
}

// Add sleep helper function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Add connection test before starting load test
async function testConnection() {
    return new Promise((resolve, reject) => {
        console.log(`Testing connection to ${config.TARGET_HOST}:${config.TARGET_PORT}...`);
        const req = http.request({
            agent: agent,
            hostname: config.TARGET_HOST,
            port: config.TARGET_PORT,
            path: '/api/questions?limit=1',
            method: 'GET',
            timeout: config.REQUEST_TIMEOUT,
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Connection test successful! Status: ${res.statusCode}`);
                resolve();
            });
        });

        req.on('error', (error) => {
            logError(error, 'Connection Test');
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            const error = new Error('Connection test timeout');
            logError(error, 'Connection Test');
            reject(error);
        });

        req.end();
    });
}

async function makeRequest(retryCount = 0) {
    const startTime = Date.now();
    stats.lastRequestTime = new Date().toISOString();
    stats.activeRequests++;

    return new Promise((resolve, reject) => {
        console.log(`[${new Date().toISOString()}] Starting request (retry ${retryCount})`);

        const req = http.request(options, (res) => {
            stats.lastStatusCode = res.statusCode;
            console.log(`[${new Date().toISOString()}] Response status: ${res.statusCode}`);
            console.log('Response headers:', JSON.stringify(res.headers, null, 2));

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                stats.lastResponseBody = data;

                try {
                    const response = JSON.parse(data);
                    stats.lastResponse = response;
                    console.log(`[${new Date().toISOString()}] Response body:`, JSON.stringify(response, null, 2));

                    if (res.statusCode === 200) {
                        stats.successfulRequests++;
                        stats.totalResponseTime += responseTime;
                        stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
                        stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
                        resolve();
                    } else {
                        stats.failedRequests++;
                        const error = new Error(`Request failed with status ${res.statusCode}: ${data}`);
                        error.statusCode = res.statusCode;
                        error.responseBody = data;
                        console.error(`[${new Date().toISOString()}] Request failed:`, {
                            statusCode: res.statusCode,
                            responseTime,
                            responseBody: data,
                            headers: res.headers
                        });
                        reject(error);
                    }
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Error parsing response:`, {
                        error: error.message,
                        rawData: data,
                        statusCode: res.statusCode
                    });
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            const endTime = Date.now();
            console.error(`[${new Date().toISOString()}] Request error:`, {
                error: error.message,
                code: error.code,
                retryCount,
                responseTime: endTime - startTime
            });
            stats.failedRequests++;
            reject(error);
        });

        req.on('timeout', () => {
            console.error(`[${new Date().toISOString()}] Request timeout after ${config.REQUEST_TIMEOUT}ms`);
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    }).finally(() => {
        stats.activeRequests--;
    });
}

async function runLoadTest() {
    console.log('Starting load test with configuration:', {
        ...config,
        startTime: new Date().toISOString()
    });

    stats.testStartTime = Date.now();
    const endTime = stats.testStartTime + config.TEST_DURATION;
    const runningRequests = new Set();

    while (Date.now() < endTime) {
        // Ensure we don't exceed concurrent request limit
        while (runningRequests.size < config.CONCURRENT_REQUESTS && Date.now() < endTime) {
            const request = makeRequest()
                .catch(error => {
                    console.error(`[${new Date().toISOString()}] Request failed:`, {
                        error: error.message,
                        statusCode: error.statusCode,
                        responseBody: error.responseBody,
                        stats: {
                            activeRequests: stats.activeRequests,
                            successfulRequests: stats.successfulRequests,
                            failedRequests: stats.failedRequests,
                            lastError: stats.lastError,
                            lastResponse: stats.lastResponse,
                            lastStatusCode: stats.lastStatusCode
                        }
                    });
                })
                .finally(() => {
                    runningRequests.delete(request);
                });

            runningRequests.add(request);
            await sleep(config.REQUEST_DELAY);
        }

        // Wait for some requests to complete if we've hit the limit
        if (runningRequests.size >= config.CONCURRENT_REQUESTS) {
            await Promise.race([...runningRequests]);
        }
    }

    // Wait for all remaining requests to complete
    if (runningRequests.size > 0) {
        console.log(`Waiting for ${runningRequests.size} remaining requests to complete...`);
        await Promise.allSettled([...runningRequests]);
    }

    const totalTime = Date.now() - stats.testStartTime;
    const requestsPerSecond = (stats.successfulRequests + stats.failedRequests) / (totalTime / 1000);
    const avgResponseTime = stats.totalResponseTime / stats.successfulRequests || 0;

    console.log('\nLoad test completed. Results:', {
        totalRequests: stats.successfulRequests + stats.failedRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
        minResponseTime: `${stats.minResponseTime === Infinity ? 0 : stats.minResponseTime}ms`,
        maxResponseTime: `${stats.maxResponseTime}ms`,
        requestsPerSecond: requestsPerSecond.toFixed(2),
        totalTime: `${totalTime}ms`,
        lastError: stats.lastError,
        lastResponse: stats.lastResponse,
        lastStatusCode: stats.lastStatusCode,
        errorCounts: stats.errorCounts
    });
}

async function main() {
    try {
        // Test connection first
        await testConnection();

        console.log('\nStarting load test with configuration:');
        console.log(JSON.stringify(config, null, 2));

        // Start the load test
        await runLoadTest();
    } catch (error) {
        console.error('Load test failed:', error.message);
        process.exit(1);
    }
}

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    stats.lastError = error;
});

main();
