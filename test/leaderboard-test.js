const { withRetry } = require('./utils/retry');
const fetch = require('node-fetch');

// Configuration
const config = {
    api: {
        url: 'http://localhost:4003',
        timeout: 5000,
        concurrency: 10,
        requestDelay: 500,
        testDuration: 60000,
        batchSize: 50,
        batchDelay: 5000
    }
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

async function getLeaderboard() {
    const startTime = Date.now();
    try {
        const result = await withRetry(async () => {
            const response = await fetch(`${config.api.url}/api/leaderboard`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                timeout: config.api.timeout
            });

            if (!response.ok) {
                const error = new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
                error.statusCode = response.status;
                throw error;
            }

            // Only parse if needed
            await response.text();
            return response;
        }, {
            onRetry: ({ error, attempt, delay, willRetry }) => {
                console.log(`Leaderboard fetch failed, ${willRetry ? 'retrying' : 'giving up'} (${attempt}/5) after ${delay.toFixed(2)}ms: ${error.message}`);
            }
        });

        stats.successfulRequests++;
        return result;
    } catch (error) {
        stats.failedRequests++;
        const statusCode = error.statusCode || error.code || 'unknown';
        stats.errors[statusCode] = (stats.errors[statusCode] || 0) + 1;
        console.error('Failed to fetch leaderboard:', error);
        throw error;
    } finally {
        stats.totalRequests++;
        stats.responseTimes.push(Date.now() - startTime);
    }
}

async function submitScore(username, score) {
    const startTime = Date.now();
    try {
        // Validate input before sending
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            throw new Error('Username is required and must be a non-empty string');
        }
        if (username.length > 50) {
            throw new Error('Username must be 50 characters or less');
        }
        if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
            throw new Error('Score must be a non-negative integer');
        }

        const result = await withRetry(async () => {
            const response = await fetch(`${config.api.url}/api/leaderboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: username.trim(),
                    score 
                }),
                timeout: config.api.timeout
            });

            if (!response.ok) {
                const error = new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
                error.statusCode = response.status;
                throw error;
            }

            // Parse and validate response
            const data = await response.json();
            if (!data.username || !Number.isInteger(data.score)) {
                throw new Error('Invalid response format from server');
            }
            return data;
        }, {
            onRetry: ({ error, attempt, delay, willRetry }) => {
                console.log(`Score submission failed, ${willRetry ? 'retrying' : 'giving up'} (${attempt}/5) after ${delay.toFixed(2)}ms: ${error.message}`);
            }
        });

        stats.successfulRequests++;
        return result;
    } catch (error) {
        stats.failedRequests++;
        const statusCode = error.statusCode || error.code || 'unknown';
        stats.errors[statusCode] = (stats.errors[statusCode] || 0) + 1;
        console.error('Failed to submit score:', error);
        throw error;
    } finally {
        stats.totalRequests++;
        stats.responseTimes.push(Date.now() - startTime);
    }
}

async function processBatch(size) {
    const batch = Array(size).fill().map(() => ({
        username: `Test_${Math.random().toString(36).substring(7)}`.slice(0, 45), // Ensure under 50 chars
        score: Math.floor(Math.random() * 1000) // Non-negative integer
    }));

    const promises = batch.map(({ username, score }) => 
        submitScore(username, score)
            .catch(error => console.error(`Batch item failed: ${error.message}`))
    );

    await Promise.all(promises);
    await new Promise(resolve => setTimeout(resolve, config.api.batchDelay));
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

async function runLoadTest() {
    try {
        console.log('\nStarting Leaderboard Load Test...');
        console.log('Configuration:', config);

        stats.startTime = Date.now();

        // Initial leaderboard check
        await getLeaderboard();
        
        // Run batches of score submissions
        while (Date.now() - stats.startTime < config.api.testDuration) {
            await processBatch(config.api.batchSize);
            global.gc && global.gc(); // Run garbage collection if available
        }

        // Final leaderboard check
        await getLeaderboard();

        stats.endTime = Date.now();
        printResults();
    } catch (error) {
        console.error('Test suite failed:', error);
    }
}

// Enable garbage collection if running with --expose-gc
if (global.gc) {
    console.log('Garbage collection enabled');
}

runLoadTest();
