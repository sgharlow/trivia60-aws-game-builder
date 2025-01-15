/**
 * GameController Class - Manages the core game logic and state for the trivia game
 * Handles question management, scoring, timer, and game progression
 */
import { mockQuestions } from './mock-questions.js';
import { LeaderboardService } from './leaderboard-service.js';
import logger from './logger-service.js';
import apiService from './api-service.js';

export class GameController {
    /**
     * Initializes the game controller with UI reference and default game state
     * @param {UI} ui - Reference to the UI class instance
     */
    constructor(ui) {
        logger.info('Initializing GameController...');
        this.ui = ui;
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.timeRemaining = 60;
        this.timerInterval = null;
        this.isGameRunning = false;
        this.ui.setGameController(this);
        logger.debug('GameController initialized with UI:', this.ui);
    }

    /**
     * Starts a new game session
     * Fetches questions from API or falls back to mock questions
     * Initializes game state and displays first question
     */
    async startGame() {
        logger.info('Starting game...');
        try {
            // Reset game state
            this.currentQuestionIndex = 0;
            this.score = 0;
            this.timeRemaining = 60;
            this.ui.updateScore(this.score);
            this.ui.updateTimer(this.timeRemaining);

            logger.debug('Game state reset:', {
                currentQuestionIndex: this.currentQuestionIndex,
                score: this.score,
                timeRemaining: this.timeRemaining
            });

            // Get questions from API service
            logger.info('Fetching questions from API...');
            try {
                this.questions = await apiService.getQuestions();
                logger.info(`Received ${this.questions.length} questions from API`);
            } catch (error) {
                logger.warn('Failed to get questions from API, using mock questions:', error);
                this.questions = mockQuestions;
            }

            // Process and validate each question
            logger.debug('Processing and validating questions...');
            const validatedQuestions = this.questions.map(q => this.validateAndFormatQuestion(q)).filter(q => q !== null);
            logger.info(`Validated questions: ${validatedQuestions.length} of ${this.questions.length} are valid`);

            if (validatedQuestions.length === 0) {
                throw new Error('No valid questions available');
            }

            this.questions = validatedQuestions;

            // Show first question and start game
            logger.info('Starting game with validated questions');
            this.displayCurrentQuestion();
            this.ui.showGameScreen();
            this.startTimer();
            this.isGameRunning = true;
        } catch (error) {
            logger.error('Error starting game:', {
                error: error.message,
                stack: error.stack
            });

            // Show error to user
            alert('Unable to start game. Please try again later.');
        }
    }

    /**
     * Starts the game timer
     * Updates UI every second and ends game when time runs out
     */
    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.ui.updateTimer(this.timeRemaining);

            if (this.timeRemaining <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    /**
     * Validates and formats a question object
     * @param {Object} question - Question object to validate
     * @returns {Object|null} - Formatted question or null if invalid
     */
    validateAndFormatQuestion(question) {
        try {
            // Log the question for debugging
            logger.debug('Validating question:', {
                hasQuestion: !!question.question,
                hasOptions: !!question.options,
                hasAnswers: !!question.answers,
                hasCorrectAnswer: typeof question.correctAnswer !== 'undefined' || typeof question.correct_answer !== 'undefined',
                fields: Object.keys(question)
            });

            // Check for required fields
            if (!question.question || 
                (!question.options && !question.answers) || 
                (!Array.isArray(question.options) && !Array.isArray(question.answers)) ||
                (typeof question.correctAnswer !== 'number' && typeof question.correct_answer !== 'number')) {
                logger.warn('Invalid question format:', question);
                return null;
            }

            // Get the answers array from either options or answers field
            const answers = question.answers || question.options;
            const originalCorrectAnswer = question.correctAnswer ?? question.correct_answer;

            // Validate answers array
            if (!Array.isArray(answers) || answers.length !== 4) {
                logger.warn('Invalid answers array:', answers);
                return null;
            }

            // Create array of answer objects with their original indices
            const indexedAnswers = answers.map((answer, index) => ({
                text: answer,
                isCorrect: index === originalCorrectAnswer
            }));

            // Shuffle the indexed answers
            const shuffledAnswers = this.shuffleArray(indexedAnswers);

            // Find the new index of the correct answer
            const newCorrectAnswerIndex = shuffledAnswers.findIndex(answer => answer.isCorrect);

            // Format the question
            return {
                question: question.question,
                options: shuffledAnswers.map(answer => answer.text),
                correct_answer: newCorrectAnswerIndex,
                text_hint: question.textHint || question.text_hint || 'No hint available',
                image_hint: question.imageHint || question.image_hint || 'https://placehold.co/200x200/ffd700/000000/png?text=No+Hint'
            };
        } catch (error) {
            logger.error('Error validating question:', error);
            return null;
        }
    }

    /**
     * Shuffles an array using Fisher-Yates algorithm
     * @param {Array} array - Array to shuffle
     * @returns {Array} - Shuffled array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Displays the current question on the UI
     */
    displayCurrentQuestion() {
        logger.debug('Displaying current question:', {
            index: this.currentQuestionIndex,
            totalQuestions: this.questions.length
        });

        if (!this.questions || this.questions.length === 0) {
            logger.error('No questions available to display');
            return;
        }

        if (this.currentQuestionIndex >= this.questions.length) {
            logger.error('Current question index out of bounds:', {
                currentIndex: this.currentQuestionIndex,
                totalQuestions: this.questions.length
            });
            return;
        }

        const currentQuestion = this.questions[this.currentQuestionIndex];
        logger.debug('Current question data:', {
            question: currentQuestion.question,
            optionsCount: currentQuestion.options.length
        });

        this.ui.displayQuestion(currentQuestion);
    }

    /**
     * Handles user answer submission
     * Updates score and progresses to next question
     * @param {number} selectedIndex - Index of the selected answer
     */
    submitAnswer(selectedIndex) {
        if (!this.isGameRunning) return;

        const question = this.questions[this.currentQuestionIndex];
        const isCorrect = selectedIndex === question.correct_answer;

        if (isCorrect) {
            this.score += 100;
            this.ui.updateScore(this.score);
        }

        this.ui.showAnswer(selectedIndex, question.correct_answer);
        logger.info('Answer submitted:', { selectedIndex, isCorrect, score: this.score });

        setTimeout(() => {
            this.currentQuestionIndex++;
            if (this.currentQuestionIndex < this.questions.length) {
                this.displayCurrentQuestion();
            } else {
                this.endGame();
            }
        }, 1000);
    }

    /**
     * Ends the current game session
     * Stops the timer, calculates final score, and handles game over logic
     */
    async endGame() {
        logger.info('=== Game Over ===', {
            finalScore: this.score,
            questionsAnswered: this.currentQuestionIndex,
            timeRemaining: this.timeRemaining
        });
        
        // Stop the timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // Mark game as not running
        this.isGameRunning = false;

        // Hide game screen and show end screen
        await this.ui.showEndScreen();

        // Skip score submission if score is negative
        if (this.score < 0) {
            logger.warn('=== Score Not Submitted ===', {
                reason: 'Negative score',
                score: this.score,
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Prompt for username
        const username = this.promptForUsername();

        // Submit score if username is provided
        if (username) {
            try {
                // Log score submission attempt
                logger.debug('=== Preparing Score Submission ===', {
                    username: username,
                    score: this.score,
                    timestamp: new Date().toISOString()
                });

                // Validate score data before submission
                if (typeof this.score !== 'number' || !Number.isInteger(this.score)) {
                    throw new Error('Invalid score type - must be an integer');
                }

                const scoreData = {
                    username: username.trim(),
                    score: this.score
                };

                logger.debug('=== Submitting Score ===', {
                    data: scoreData,
                    timestamp: new Date().toISOString()
                });
                
                // Submit score to leaderboard
                await apiService.submitScore(scoreData);

                logger.info('=== Score Submitted Successfully ===', {
                    username: username,
                    score: this.score,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                logger.error('=== Score Submission Error ===', {
                    error: error.message,
                    name: error.name,
                    stack: error.stack,
                    username: username,
                    score: this.score,
                    timestamp: new Date().toISOString()
                });
                
                // Show error to user
                const errorMessage = error.message.includes('Internal server error')
                    ? 'Unable to save score. Please try again later.'
                    : `Failed to submit score: ${error.message}`;
                
                alert(errorMessage);
            }
        } else {
            logger.warn('=== Score Not Submitted ===', {
                reason: 'No username provided',
                score: this.score,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Prompts user for username
     * @returns {string|null} - Username or null if cancelled
     */
    promptForUsername() {
        logger.debug('=== Prompting for Username ===');

        // First, try to get username from local storage
        let username = localStorage.getItem('trivia_username');
        
        logger.debug('=== Stored Username Check ===', {
            hasStoredUsername: !!username,
            storedUsername: username
        });

        // If no stored username, prompt the user
        if (!username) {
            username = prompt('Enter your username to save your score:');
            logger.debug('=== Username Prompt Result ===', {
                promptedUsername: username,
                wasPrompted: true
            });
        }

        // Validate username
        if (username && username.trim() !== '') {
            const cleanUsername = username.trim();
            
            // Additional validation
            if (cleanUsername.length > 50) {
                logger.warn('=== Username Validation Failed ===', {
                    reason: 'Too long',
                    length: cleanUsername.length,
                    maxLength: 50
                });
                alert('Username must be 50 characters or less');
                return null;
            }

            // Save username to local storage for future use
            localStorage.setItem('trivia_username', cleanUsername);
            
            logger.info('=== Username Validated ===', {
                username: cleanUsername,
                length: cleanUsername.length,
                source: username === localStorage.getItem('trivia_username') ? 'storage' : 'prompt'
            });
            
            return cleanUsername;
        }

        logger.warn('=== Username Validation Failed ===', {
            reason: 'Empty or cancelled',
            rawUsername: username
        });

        return null;
    }

    /**
     * Shows the hint for the current question
     */
    showTextHint() {
        if (!this.isGameRunning) return;
        const currentQuestion = this.questions[this.currentQuestionIndex];
        if (currentQuestion && currentQuestion.text_hint) {
            this.ui.showHint('text', currentQuestion.text_hint);
            this.ui.disableHintButton('text');
            this.score -= 25;
            this.ui.updateScore(this.score);
        }
    }

    showImageHint() {
        if (!this.isGameRunning) return;
        const currentQuestion = this.questions[this.currentQuestionIndex];
        if (currentQuestion && currentQuestion.image_hint) {
            this.ui.showHint('image', currentQuestion.image_hint);
            this.ui.disableHintButton('image');
            this.score -= 50;
            this.ui.updateScore(this.score);
        }
    }
}
