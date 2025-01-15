const app = require('./index');
const port = process.env.PORT || 4003;

app.listen(port, () => {
    console.log(`=== Leaderboard Service Started ===`, {
        port,
        timestamp: new Date().toISOString()
    });
});

// Keep the process running and handle cleanup
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    app.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
