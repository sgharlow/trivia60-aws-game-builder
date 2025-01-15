const { createApp, generateQuestions } = require('./index');

const port = process.env.PORT || 4002;
let server;

// Function to calculate milliseconds until next midnight GMT-7
function getMsUntilMidnight() {
    const now = new Date();
    // Convert to GMT-7
    now.setHours(now.getHours() - 7);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    // Convert back to local time for the difference
    tomorrow.setHours(tomorrow.getHours() + 7);
    return tomorrow - now;
}

// Schedule next run at midnight GMT-7
function scheduleNextRun() {
    const msUntilMidnight = getMsUntilMidnight();
    console.log(`Scheduling next question generation in ${Math.floor(msUntilMidnight / 1000 / 60)} minutes`);
    
    setTimeout(async () => {
        try {
            console.log('Starting scheduled question generation...');
            await generateQuestions();
            console.log('Scheduled question generation completed');
        } catch (error) {
            console.error('Error in scheduled question generation:', error);
        } finally {
            // Schedule next run regardless of success/failure
            scheduleNextRun();
        }
    }, msUntilMidnight);
}

async function startServer() {
    try {
        // Create and start the Express app first
        const app = await createApp();
        server = app.listen(port, () => {
            console.log(`Add Questions API listening at http://localhost:${port}`);
        });

        // Handle shutdown signals
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Run initial question generation after server is up
        console.log('Running initial question generation...');
        try {
            await generateQuestions();
            console.log('Initial question generation completed');
        } catch (error) {
            console.error('Initial question generation failed:', error);
            // Don't exit, just log the error
        }

        // Schedule next run
        scheduleNextRun();
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

async function shutdown(signal) {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    if (server) {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}

startServer();
