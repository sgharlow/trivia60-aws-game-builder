require('dotenv').config();
console.log('Environment loaded');

try {
    const { createApp } = require('./index');
    console.log('App module loaded');

    console.log('Creating Express app...');
    const app = createApp();
    console.log('Express app created');

    const PORT = process.env.PORT || 4001;
    console.log(`Attempting to start server on port ${PORT}...`);

    const server = app.listen(PORT, () => {
        console.log(`Local Lambda server running at http://localhost:${PORT}`);
        console.log('Database URL:', process.env.POSTGRES_URL);
        console.log('Environment:', process.env.NODE_ENV);
    }).on('error', (err) => {
        console.error('Server error:', err);
        process.exit(1);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('Shutting down server...');
        server.close(() => {
            console.log('Server shut down successfully');
            process.exit(0);
        });
    });
} catch (error) {
    console.error('Error during startup:', error);
    process.exit(1);
}
