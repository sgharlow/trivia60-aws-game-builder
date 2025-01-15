# Trivia60 - 60-Second Trivia Game

A web-based trivia game that challenges players to answer questions within 60 seconds, featuring a global leaderboard and dynamic question generation.

## Project Structure

### Root Directory
- `.env` - Environment configuration file for API keys and settings
- `.gitignore` - Git ignore configuration
- `endpoints.md` - API endpoint documentation
- `s3-sync.bat` - Batch script for syncing with AWS S3
- `vpc-policy.json` - AWS VPC policy configuration
- `leaderboard-function.js` - Lambda function for leaderboard functionality

### /apis
Main API directory containing three core services:
- `/add-questions` - API for adding new questions to the database
- `/get-questions` - API for retrieving trivia questions
- `/leaderboard` - API for managing and displaying the global leaderboard

### /frontend
Web client implementation:
- `index.html` - Main game interface
- `server.js` - Development server configuration
- `/js` 
  - `leaderboard-service.js` - Handles leaderboard API interactions
  - `ui.js` - Manages game UI and user interactions
  - Other JavaScript modules for game logic
- `/styles` - CSS styling files
- `/assets` - Static assets and images
- `package.json` - Frontend dependencies
- `.env-frontend.example` - Example frontend environment configuration
- `s3-cors-config.json` - CORS configuration for S3
- `website-cors-config.json` - Website CORS settings

### /config
Configuration files for various services and environments

### /assets
Static assets used across the project

### /certificates
SSL/TLS certificates for secure connections

### /docs
Project documentation and specifications

### /tests
Test suite for API and frontend functionality

### Potentially Obsolete Directories
- `easy-rsa` - Appears to be unused VPN-related directory
- `vpn-config` - VPN configuration files, may not be actively used
- `certificates` - May contain outdated certificates

## Project Overview

Trivia60 is a full-stack web application that combines vanilla JavaScript frontend with serverless AWS Lambda functions for the backend. The game presents players with trivia questions that must be answered within a 60-second time limit. Questions are dynamically fetched from a managed PostgreSQL database through the get-questions API, while scores and player rankings are maintained via the leaderboard API.

### Key Features
- 60-second time limit for each game session
- Real-time scoring and timer functionality
- Global leaderboard with persistent rankings
- Dynamic question generation and retrieval
- Support for both www and non-www domains (trivia60.com)
- Secure API access with API key authentication
- Cross-Origin Resource Sharing (CORS) support for multiple domains

### Technical Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: AWS Lambda (Node.js 18.x)
- **Database**: PostgreSQL on Amazon RDS
- **Hosting**: Amazon S3 with CloudFront CDN
- **API Gateway**: RESTful endpoints with API key authentication
- **VPC**: Private network for secure database access
- **Monitoring**: CloudWatch for logs and metrics

### API Endpoints
- Leaderboard API: `<insert API endpoints here>`
  - GET: Retrieve current leaderboard
  - POST: Submit new scores
  - Requires x-api-key header for authentication

### Port Configuration
#### Development Environment
| Service | Host Port | Container Port | URL |
|---------|-----------|----------------|-----|
| PostgreSQL | 5433 | 5432 | localhost:5433 |
| Get Questions API | 4001 | 4001 | localhost:4001 |
| Add Questions API | 4002 | 4002 | localhost:4002 |
| Leaderboard API | 4003 | 4003 | localhost:4003 |
| Frontend | 8080 | 80 | localhost:8080 |

#### CORS Allowed Origins
The following origins are allowed for Cross-Origin Resource Sharing:
- http://localhost:3000
- http://localhost:5000
- https://trivia60.com

#### Port Usage Notes
- The PostgreSQL port is mapped to 5433 on the host to avoid conflicts with any local PostgreSQL installations
- All API services run on fixed ports for consistency
- The frontend nginx server runs on port 8080 to avoid conflicts with common development servers
- Additional development servers can run on ports 3000 and 5000 if needed