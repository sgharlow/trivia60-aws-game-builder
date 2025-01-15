# Frontend JavaScript

This directory contains all the frontend JavaScript code for the AI Trivia application.

## Key Files

- `api-service.js` - Handles API calls to the backend services
- `game-logic.js` - Core game mechanics and state management
- `ui-controller.js` - User interface interactions and DOM manipulation
- `question-handler.js` - Question display and answer processing
- `score-tracker.js` - Score management and leaderboard functionality

## Architecture

The frontend code follows a modular architecture where each file has a specific responsibility:
- API calls are centralized in the api-service
- Game state is managed separately from UI
- UI updates are handled through a controller pattern
- Event handling is decoupled from business logic
