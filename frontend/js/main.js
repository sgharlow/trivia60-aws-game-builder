import { UI } from './ui.js';
import { GameController } from './game-controller.js';

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    
    try {
        const ui = new UI();
        const gameController = new GameController(ui);
        console.log('Game initialized successfully');
    } catch (error) {
        console.error('Error initializing game:', error);
    }
});

function startGame() {
    gameState.reset();
    ui.showScreen(ui.questionContainer);
    ui.updateScore(gameState.score);
    displayCurrentQuestion();
    startTimer();
}

function displayCurrentQuestion() {
    const currentQuestion = gameState.getCurrentQuestion();
    ui.displayQuestion(currentQuestion);
}

function handleAnswer(answerIndex) {
    gameState.stopTimer();
    const result = gameState.submitAnswer(answerIndex);
    
    ui.showAnswer(answerIndex, result.isCorrect, result.correctAnswer);
    ui.updateScore(gameState.score);

    setTimeout(() => {
        const hasNextQuestion = gameState.nextQuestion();
        if (hasNextQuestion) {
            displayCurrentQuestion();
            startTimer();
        } else {
            endGame();
        }
    }, 2000);
}

function startTimer() {
    gameState.startTimer((timeRemaining) => {
        ui.updateTimer(timeRemaining);
        if (timeRemaining <= 0) {
            handleAnswer(-1); // Force incorrect answer when time runs out
        }
    });
}

function endGame() {
    ui.showGameOver(gameState.score, gameState.questions);
    
    // Update leaderboard with player's score (in a real app, this would be sent to a server)
    const newLeaderboard = [...mockLeaderboard];
    newLeaderboard.push({ username: "You", score: gameState.score, streak: 1 });
    newLeaderboard.sort((a, b) => b.score - a.score);
    newLeaderboard.pop(); // Remove lowest score
    ui.updateLeaderboard(newLeaderboard);
}
