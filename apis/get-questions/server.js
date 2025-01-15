const { createApp } = require('./index');

// Initialize and start the server
const app = createApp();

// The app.listen() is already called inside createApp()
// Just keep the process running and handle cleanup
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});
