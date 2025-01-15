const { createApp } = require('./index');

const app = createApp();
const port = 4002;

app.listen(port, () => {
    console.log(`Question Generating API listening at http://localhost:${port}`);
    console.log(`Test with: curl http://localhost:${port}/api/add-questions`);
});
