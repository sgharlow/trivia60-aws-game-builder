/**
 * UI Class - Handles all user interface interactions and display logic for the trivia game
 * Manages the game screens, button interactions, and visual feedback for the player
 */

import apiService from './api-service.js';

/**
 * Initializes the UI class with all necessary DOM elements and event handlers
 * Sets up references to screen elements, buttons, and game display components
 */
export class UI {
    /**
     * Initializes the UI class with all necessary DOM elements and event handlers
     * Sets up references to screen elements, buttons, and game display components
     */
    constructor() {
        console.log('Initializing UI...');
        
        // Initialize screen elements
        this.splashScreen = document.getElementById('splash-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.endScreen = document.getElementById('end-screen');

        // Initialize buttons
        this.startBtn = document.getElementById('start-btn');
        this.playAgainBtn = document.getElementById('play-again-btn');
        this.textHintBtn = document.getElementById('text-hint-btn');
        this.imageHintBtn = document.getElementById('image-hint-btn');

        // Initialize game display elements
        this.questionText = document.getElementById('question-text');
        this.answersContainer = document.getElementById('answers-container');
        this.scoreDisplay = document.getElementById('current-score');
        this.timerDisplay = document.getElementById('time-remaining');
        this.finalScoreDisplay = document.getElementById('final-score-value');
        this.hintDisplay = document.getElementById('hint-display');
        this.hintText = document.getElementById('hint-text');
        this.hintImage = document.getElementById('hint-image');

        // Initialize game controller reference
        this.gameController = null;

        console.log('UI initialized with elements:', {
            splashScreen: !!this.splashScreen,
            gameScreen: !!this.gameScreen,
            endScreen: !!this.endScreen,
            startBtn: !!this.startBtn,
            questionText: !!this.questionText,
            answersContainer: !!this.answersContainer
        });

        this.setupEventListeners();
    }

    /**
     * Sets the game controller instance for this UI
     * Enables communication between UI and game logic
     * @param {GameController} controller - The game controller instance
     */
    setGameController(controller) {
        console.log('Setting game controller:', controller);
        this.gameController = controller;
    }

    /**
     * Sets up all event listeners for game interactions
     * Handles button clicks for game start, play again, answers, and hints
     */
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Start button click handler
        if (this.startBtn) {
            console.log('Adding click handler to start button');
            this.startBtn.addEventListener('click', () => {
                console.log('Start button clicked');
                if (this.gameController) {
                    console.log('Calling startGame on controller');
                    this.gameController.startGame();
                } else {
                    console.error('No game controller set');
                }
            });
        } else {
            console.error('Start button not found!');
        }

        // Play again button click handler
        if (this.playAgainBtn) {
            console.log('Adding click handler to play again button');
            this.playAgainBtn.addEventListener('click', () => {
                console.log('Play again button clicked');
                if (this.gameController) {
                    // Hide end screen and show splash screen
                    this.endScreen.classList.add('hidden');
                    this.splashScreen.classList.remove('hidden');
                    // Reset score display
                    if (this.scoreDisplay) {
                        this.scoreDisplay.textContent = '0';
                    }
                }
            });
        } else {
            console.error('Play again button not found!');
        }

        // Answer buttons click handler
        if (this.answersContainer) {
            this.answersContainer.addEventListener('click', (event) => {
                const button = event.target.closest('.answer-btn');
                if (button && this.gameController && !button.disabled) {
                    const answerIndex = parseInt(button.dataset.index, 10);
                    if (!isNaN(answerIndex)) {
                        // Change text color to black for the pressed button
                        button.style.color = 'black';
                        // Trigger visual feedback
                        this.gameController.submitAnswer(answerIndex);
                    }
                }
            });
        }

        // Hint buttons click handlers
        if (this.textHintBtn) {
            this.textHintBtn.addEventListener('click', () => {
                if (this.gameController) {
                    this.gameController.showTextHint();
                }
            });
        }

        if (this.imageHintBtn) {
            this.imageHintBtn.addEventListener('click', () => {
                if (this.gameController) {
                    this.gameController.showImageHint();
                }
            });
        }

        console.log('Event listeners set up');
    }

    /**
     * Transitions from splash screen to game screen
     * Hides splash screen and displays the main game interface
     */
    showGameScreen() {
        console.log('Showing game screen');
        if (this.splashScreen && this.gameScreen) {
            this.splashScreen.classList.add('hidden');
            this.gameScreen.classList.remove('hidden');
        } else {
            console.error('Game screen elements not found');
        }
    }

    /**
     * Displays a question on the game screen
     * @param {Object} question - The question object to display
     */
    displayQuestion(question) {
        console.log('Displaying question:', question);
        // Display question text
        this.questionText.textContent = question.question;

        // Clear previous answers
        this.answersContainer.innerHTML = '';

        // Create and display answer buttons
        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.textContent = option;
            button.classList.add('answer-btn');
            button.dataset.index = index;  // Store the index for answer feedback
            button.addEventListener('click', (event) => {
                if (this.gameController) {
                    const answerIndex = parseInt(event.target.dataset.index, 10);
                    this.gameController.submitAnswer(answerIndex);
                }
            });
            this.answersContainer.appendChild(button);
        });

        // Reset hint display and buttons
        this.resetHints();
    }

    /**
     * Resets the hint display and re-enables hint buttons
     * Called when moving to a new question or restarting game
     */
    resetHints() {
        if (this.hintDisplay) {
            this.hintDisplay.classList.add('hidden');
        }
        if (this.hintText) {
            this.hintText.textContent = '';
            this.hintText.classList.add('hidden');
        }
        if (this.hintImage) {
            this.hintImage.src = '';
            this.hintImage.classList.add('hidden');
        }

        // Re-enable hint buttons
        if (this.textHintBtn) {
            this.textHintBtn.disabled = false;
        }
        if (this.imageHintBtn) {
            this.imageHintBtn.disabled = false;
        }
    }

    /**
     * Updates the score display with new value
     * @param {number} score - Current game score
     */
    updateScore(score) {
        if (this.scoreDisplay) {
            this.scoreDisplay.textContent = `Score: ${score}`;
        }
    }

    /**
     * Updates the timer display with remaining time
     * @param {number} time - Remaining time in seconds
     */
    updateTimer(time) {
        if (this.timerDisplay) {
            this.timerDisplay.textContent = `Time: ${time}s`;
        }
    }

    /**
     * Shows the end game screen with final score
     * @param {number} finalScore - Player's final score
     */
    showEndScreen(finalScore) {
        console.log('Showing end screen with score:', finalScore);
        if (this.gameScreen && this.endScreen && this.finalScoreDisplay) {
            // Hide game screen
            this.gameScreen.classList.add('hidden');
            
            // Update final score
            this.finalScoreDisplay.textContent = finalScore;
            
            // Show end screen
            this.endScreen.classList.remove('hidden');
            
            // Make sure play again button is visible
            if (this.playAgainBtn) {
                this.playAgainBtn.style.display = 'block';
            }
        }
    }

    /**
     * Shows the game over screen with the final score
     * @param {number} finalScore - The player's final score
     */
    showGameOver(finalScore) {
        console.log('Showing game over screen with score:', finalScore);
        if (this.gameScreen && this.endScreen && this.finalScoreDisplay) {
            // Hide game screen and show end screen
            this.gameScreen.classList.add('hidden');
            this.endScreen.classList.remove('hidden');
            
            // Display final score
            this.finalScoreDisplay.textContent = finalScore;
        } else {
            console.error('Game over screen elements not found');
        }
    }

    /**
     * Displays either text or image hints
     * Handles loading states and error cases for image hints
     * @param {string} type - Type of hint ('text' or 'image')
     * @param {string} content - Hint content (text or image URL)
     */
    showHint(type, content) {
        console.log('Showing hint:', type, content);
        if (!this.hintDisplay || !this.hintText || !this.hintImage) {
            console.error('Hint elements not found');
            return;
        }

        // Show the hint display container
        this.hintDisplay.classList.remove('hidden');

        if (type === 'text') {
            // Show text hint
            this.hintText.textContent = content;
            this.hintText.classList.remove('hidden');
            this.hintImage.classList.add('hidden');
        } else if (type === 'image') {
            if (!content || !(content.startsWith('http://') || content.startsWith('https://'))) {
                console.error('Invalid image URL:', content);
                this.hintText.textContent = 'Sorry, the image hint could not be loaded. Invalid URL.';
                this.hintText.classList.remove('hidden');
                this.hintImage.classList.add('hidden');
                return;
            }

            // Show loading message while image loads
            this.hintText.textContent = 'Loading image hint...';
            this.hintText.classList.remove('hidden');
            
            // Preload the image first
            const img = new Image();
            
            img.onload = () => {
                // Hide loading text
                this.hintText.classList.add('hidden');
                
                // Show and set the image
                this.hintImage.classList.remove('hidden');
                this.hintImage.src = content;
                this.hintImage.alt = 'Question hint image';
            };
            
            img.onerror = (error) => {
                console.error('Error loading image:', error);
                console.error('Failed URL:', content);
                this.hintText.textContent = 'Sorry, the image hint could not be loaded. Please try again.';
                this.hintText.classList.remove('hidden');
                this.hintImage.classList.add('hidden');
            };
            
            // Start loading the image
            img.src = content;
        }
    }

    /**
     * Disables a hint button after use
     * @param {string} type - Type of hint button to disable ('text' or 'image')
     */
    disableHintButton(type) {
        const button = type === 'text' ? this.textHintBtn : this.imageHintBtn;
        if (button) {
            button.disabled = true;
        }
    }

    /**
     * Shows visual feedback for selected and correct answers
     * @param {number} selectedIndex - Index of player's selected answer
     * @param {number} correctIndex - Index of correct answer
     */
    showAnswer(selectedIndex, correctIndex) {
        const answerButtons = this.answersContainer.children;
        
        // Disable all buttons to prevent multiple selections
        for (let button of answerButtons) {
            button.disabled = true;
        }

        // Show feedback immediately
        const selectedButton = answerButtons[selectedIndex];
        const correctButton = answerButtons[correctIndex];

        // Clear any existing classes
        for (let button of answerButtons) {
            button.classList.remove('correct', 'incorrect');
        }

        // Add appropriate classes
        if (selectedIndex === correctIndex) {
            selectedButton.classList.add('correct');
        } else {
            selectedButton.classList.add('incorrect');
            correctButton.classList.add('correct');
        }

        // Remove feedback after 750ms
        setTimeout(() => {
            for (let button of answerButtons) {
                button.classList.remove('correct', 'incorrect');
            }
        }, 750);
    }

    /**
     * Populates the leaderboard with mock data
     * TODO: Implement real leaderboard data integration
     */
    populateLeaderboard() {
        const leaderboardBody = document.getElementById('leaderboard-body');
        leaderboardBody.innerHTML = '';

        this.mockLeaderboardData.forEach(entry => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.rank}</td>
                <td>${entry.player}</td>
                <td>${entry.score}</td>
                <td>${entry.time}</td>
            `;
            leaderboardBody.appendChild(row);
        });
    }

    /**
     * Updates the leaderboard display with real data
     * @param {Array} leaderboardData - Array of leaderboard entries
     */
    updateLeaderboard(leaderboardData) {
        console.log('Updating leaderboard with data:', leaderboardData);
        const leaderboardBody = document.getElementById('leaderboard-body');
        if (!leaderboardBody) {
            console.error('Leaderboard table body not found');
            return;
        }

        // Clear existing rows
        leaderboardBody.innerHTML = '';

        if (!leaderboardData || leaderboardData.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="4" style="text-align: center;">No scores yet today</td>';
            leaderboardBody.appendChild(emptyRow);
            return;
        }

        // Sort leaderboard by score in descending order
        const sortedData = [...leaderboardData].sort((a, b) => {
            const scoreA = parseInt(a.score, 10) || 0;
            const scoreB = parseInt(b.score, 10) || 0;
            if (scoreB !== scoreA) {
                return scoreB - scoreA;
            }
            // If scores are equal, sort by most recent
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        // Take only top 10 scores
        const topScores = sortedData.slice(0, 10);
        
        console.log('Displaying top scores:', topScores);
        topScores.forEach((entry, index) => {
            const row = document.createElement('tr');
            
            // Format time from created_at
            const date = new Date(entry.created_at);
            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Ensure all values are strings and handle missing data
            const rank = (index + 1).toString();
            const username = (entry.username || 'Anonymous').toString();
            const score = (entry.score || 0).toString();
            
            row.innerHTML = `
                <td style="text-align: center">${rank}</td>
                <td style="padding-left: 10px">${username}</td>
                <td style="text-align: right; padding-right: 10px">${score}</td>
                <td style="text-align: center">${formattedTime}</td>
            `;
            leaderboardBody.appendChild(row);
        });
    }

    /**
     * Resets the game state for a new game
     * Resets score, timer, and hint displays
     */
    resetGame() {
        // Reset score and timer
        this.updateScore(0);
        this.updateTimer(60);

        // Reset hints
        this.hintDisplay.classList.add('hidden');
        this.textHintBtn.disabled = false;
        this.imageHintBtn.disabled = false;

        // Show splash screen
        this.showScreen('splash-screen');
    }

    /**
     * Shows a specific screen and hides others
     * @param {string} screenId - ID of the screen to show
     */
    showScreen(screenId) {
        console.log('Showing screen:', screenId);
        
        // Hide all screens
        this.splashScreen.classList.add('hidden');
        this.gameScreen.classList.add('hidden');
        this.endScreen.classList.add('hidden');

        // Show the requested screen
        document.getElementById(screenId).classList.remove('hidden');
    }

    /**
     * Shows the end screen with final score
     */
    async showEndScreen() {
        console.log('Showing end screen');
        
        // Hide game screen
        if (this.gameScreen) {
            this.gameScreen.classList.add('hidden');
        }
        
        // Show end screen
        if (this.endScreen) {
            this.endScreen.classList.remove('hidden');
        }
        
        // Update final score display
        if (this.finalScoreDisplay) {
            this.finalScoreDisplay.textContent = this.scoreDisplay ? this.scoreDisplay.textContent : '0';
        }

        try {
            // Fetch leaderboard data
            const leaderboardData = await apiService.getLeaderboard();
            console.log('Fetched leaderboard data:', leaderboardData);
            
            // Update leaderboard display
            this.updateLeaderboard(leaderboardData);
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            // Show error message in leaderboard table
            const leaderboardBody = document.getElementById('leaderboard-body');
            if (leaderboardBody) {
                const errorRow = document.createElement('tr');
                errorRow.innerHTML = `
                    <td colspan="4" style="text-align: center; color: #ff6b6b;">
                        Unable to load leaderboard. Please try again later.
                    </td>
                `;
                leaderboardBody.innerHTML = '';
                leaderboardBody.appendChild(errorRow);
            }
        }
        
        console.log('End screen displayed with final score:', 
            this.finalScoreDisplay ? this.finalScoreDisplay.textContent : 'N/A');
    }
}
