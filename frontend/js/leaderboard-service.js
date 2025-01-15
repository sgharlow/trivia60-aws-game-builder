import logger from './logger-service.js';
import apiService from './api-service.js';

// Mock data for local development when API is not accessible
const MOCK_LEADERBOARD = [
    { username: 'Champion1', score: 800, created_at: '2024-12-24T05:12:06Z' },
    { username: 'TriviaMaster', score: 750, created_at: '2024-12-24T05:08:00Z' },
    { username: 'QuizWiz', score: 600, created_at: '2024-12-24T05:04:00Z' },
    { username: 'Brainiac', score: 550, created_at: '2024-12-24T05:00:00Z' },
    { username: 'Smarty', score: 500, created_at: '2024-12-24T04:56:00Z' }
];

export class LeaderboardService {
    static async getLeaderboard() {
        try {
            logger.info('Fetching leaderboard data...');
            const data = await apiService.getLeaderboard();
            logger.info('Leaderboard data received:', data);

            // Transform the data to include date and time from created_at
            const transformedData = data.map(entry => {
                const date = new Date(entry.created_at);
                return {
                    ...entry,
                    formattedDate: date.toLocaleDateString(),
                    formattedTime: date.toLocaleTimeString()
                };
            });

            return transformedData;
        } catch (error) {
            logger.error('Error fetching leaderboard:', error);
            return MOCK_LEADERBOARD;
        }
    }

    static async submitScore(username, score) {
        // if the score is less than 0, set it to 0
        if (score < 0) {
            score = 0;
        }
        try {
            logger.info('Submitting score:', { username, score });
            const data = await apiService.submitScore({
                username,
                score,
                timestamp: new Date().toISOString()
            });
            logger.info('Score submitted successfully:', data);
            return data;
        } catch (error) {
            logger.error('Error submitting score:', error);
            throw error;
        }
    }
}
