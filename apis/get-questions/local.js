const { createApp } = require('./index');

const app = createApp();
const port = process.env.PORT || 4001;

app.listen(port, '0.0.0.0', () => {
    console.log(`Questions API listening at http://localhost:${port}`);
    console.log(`Test with: curl http://localhost:${port}/api/questions`);
});
