// Import dependencies
import accessibilityService from './accessibility-service.js';
import apiService from './api-service.js';

class GameService {
    constructor() {
        this.score = 0;
        this.timeRemaining = 0;
        this.isGameActive = false;
        
        // Initialize UI elements
        this.scoreElement = document.getElementById('score');
        this.timeElement = document.getElementById('time');
        this.startButton = document.getElementById('start-game');
        
        // Bind event listeners
        if (this.startButton) {
            this.startButton.addEventListener('click', () => this.startGame());
        }
    }

    updateScore(newScore) {
        this.score = newScore;
        if (this.scoreElement) {
            this.scoreElement.textContent = this.score;
        }
        // Announce score update to screen readers
        accessibilityService.announceScore(this.score);
    }

    updateTime(seconds) {
        this.timeRemaining = seconds;
        if (this.timeElement) {
            this.timeElement.textContent = this.timeRemaining;
        }
        // Announce time update to screen readers at important intervals
        if (this.timeRemaining <= 10 || this.timeRemaining % 30 === 0) {
            accessibilityService.announceTime(this.timeRemaining);
        }
    }

    async startGame() {
        this.isGameActive = true;
        this.updateScore(0);
        this.updateTime(60); // 60 second game
        
        accessibilityService.announceGameStatus('Game started. Good luck!');
        
        // Start countdown timer
        const timer = setInterval(() => {
            if (this.timeRemaining > 0) {
                this.updateTime(this.timeRemaining - 1);
            } else {
                clearInterval(timer);
                this.endGame();
            }
        }, 1000);
    }

    async endGame() {
        this.isGameActive = false;
        accessibilityService.announceGameStatus(`Game over! Final score: ${this.score} points`);
        
        // Submit score to leaderboard
        try {
            await apiService.submitScore({
                score: this.score,
                completion_time: 60 - this.timeRemaining
            });
        } catch (error) {
            console.error('Failed to submit score:', error);
        }
    }
}

// Create singleton instance
const gameService = new GameService();

// Export singleton instance
export default gameService;
