const { createApp } = require('./index');

const app = createApp();
const port = 4003;

app.listen(port, () => {
    console.log(`Leaderboard API listening at http://localhost:${port}`);
    console.log(`Test GET with: curl http://localhost:${port}/api/leaderboard`);
    console.log(`Test POST with: curl -X POST -H "Content-Type: application/json" -d '{"playerName":"Test","score":100}' http://localhost:${port}/api/leaderboard`);
});
