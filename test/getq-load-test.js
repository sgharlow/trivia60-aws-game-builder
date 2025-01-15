const { withRetry } = require('./utils/retry');
const fetch = require('node-fetch');

const config = {
    concurrency: 10,  // Back to 10 concurrent requests
    requestDelay: 500,  // 500ms between requests
    timeout: 5000,
    testDuration: 60000, // 60 seconds
    apiUrl: 'http://localhost:4001',
    batchSize: 50,  // Process requests in batches
    batchDelay: 5000  // Delay between batches
};

const stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    errors: {},
    startTime: null,
    endTime: null,
    responseTimes: [],
    lastBatchTime: Date.now()
};

async function makeRequest() {
    const startTime = Date.now();
    
    try {
        const result = await withRetry(async () => {
            const response = await fetch(`${config.apiUrl}/api/questions?limit=10`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                timeout: config.timeout
            });

            if (!response.ok) {
                const error = new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
                error.statusCode = response.status;
                throw error;
            }

            // Only parse the response if we need to validate it
            await response.text();
            return response;
        }, {
            onRetry: ({ error, attempt, delay, willRetry }) => {
                console.log(`Request failed, ${willRetry ? 'retrying' : 'giving up'} (${attempt}/5) after ${delay.toFixed(2)}ms: ${error.message}`);
            }
        });

        const endTime = Date.now();
        stats.responseTimes.push(endTime - startTime);
        stats.successfulRequests++;
    } catch (error) {
        stats.failedRequests++;
        const statusCode = error.statusCode || error.code || 'unknown';
        stats.errors[statusCode] = (stats.errors[statusCode] || 0) + 1;
        console.error('Request error:', {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode
        });
    }

    stats.totalRequests++;
}

async function processBatch(size) {
    const requests = [];
    for (let i = 0; i < size && Date.now() - stats.startTime < config.testDuration; i++) {
        requests.push(makeRequest());
        await new Promise(resolve => setTimeout(resolve, config.requestDelay));
    }
    await Promise.all(requests);

    // Clear response times array periodically to prevent memory growth
    if (stats.responseTimes.length > 1000) {
        const sum = stats.responseTimes.reduce((a, b) => a + b, 0);
        const count = stats.responseTimes.length;
        stats.responseTimes = [sum / count];
    }

    // Add delay between batches
    await new Promise(resolve => setTimeout(resolve, config.batchDelay));
}

async function runLoadTest() {
    console.log(`Starting load test for ${config.testDuration / 1000} seconds with ${config.concurrency} concurrent requests...`);
    console.log('Configuration:', config);

    stats.startTime = Date.now();
    
    while (Date.now() - stats.startTime < config.testDuration) {
        await processBatch(config.batchSize);
        global.gc && global.gc(); // Run garbage collection if available
    }

    stats.endTime = Date.now();
    printResults();
}

function printResults() {
    const duration = (stats.endTime - stats.startTime) / 1000;
    const avgResponseTime = stats.responseTimes.length > 0 
        ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length 
        : 0;

    console.log('\nLoad Test Results:');
    console.log('=================');
    console.log(`Test Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Total Requests: ${stats.totalRequests}`);
    console.log(`Concurrent Requests: ${config.concurrency}`);
    console.log(`Successful Requests: ${stats.successfulRequests}`);
    console.log(`Failed Requests: ${stats.failedRequests}`);
    console.log(`Requests/Second: ${(stats.totalRequests / duration).toFixed(2)}`);
    console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);

    if (Object.keys(stats.errors).length > 0) {
        console.log('\nError Distribution:');
        console.log('==================');
        Object.entries(stats.errors).forEach(([code, count]) => {
            console.log(`${code}: ${count} occurrences (${((count / stats.totalRequests) * 100).toFixed(2)}%)`);
        });
    }
}

// Enable garbage collection if running with --expose-gc
if (global.gc) {
    console.log('Garbage collection enabled');
}

runLoadTest().catch(console.error);
