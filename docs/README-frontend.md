# Reddit Daily Trivia Game

A fun and interactive trivia game that tests your knowledge with questions from various topics. The game features a clean, modern interface with accessibility support and includes features like hints and a daily leaderboard.

## Features

- Dynamic trivia questions from an external API
- Score tracking system
- Timer for each question
- Text and image hints (with point deduction)
- Daily leaderboard
- High contrast mode for accessibility
- Keyboard navigation support
- Fallback questions when API is unavailable

## Technical Details

### Architecture

- Frontend: Pure JavaScript (ES6+) with HTML5 and CSS3
- API Integration: REST API with proxy server for CORS handling
- Caching: Client-side caching for questions with 5-minute expiry

### CORS Configuration

CORS is handled via CloudFront, allowing requests from the frontend domain (https://trivia60.com).

### API Endpoints

The game uses the following API endpoints:
- **Get Questions**:`<insert API endpoints here>`
- **Leaderboard**:`<insert API endpoints here>`

API responses follow this format:
```json
{
    "question_id": number,
    "question": string,
    "answers": string[],
    "correct_answer": number (index of correct answer),
    "hints": [
        {
            "hint_id": number,
            "hint_detail": string,
            "hint_type": "text" | "image"
        }
    ]
}
```

## Setup and Running

1. Install dependencies:
```bash
npm install
```

2. Start the proxy server (handles CORS and API key):
```bash
node proxy.js
```

3. In a separate terminal, start the static file server:
```bash
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:8080
```

## Development

### Project Structure
```
trivia-frontend/
├── frontend/           # Main React application
│   ├── src/           # React source files
│   ├── public/        # Static assets
│   └── package.json   # Frontend dependencies
├── deployment/        # Deployment configuration
│   ├── bucket-policy-web.json    # S3 bucket policy
│   └── cloudfront-update-fixed6.json  # CloudFront config
└── docs/             # Documentation
    ├── README.md     # Main documentation
    ├── DEPLOY.md     # Deployment guide
    └── CORS-solution.md  # CORS configuration
```

### Key Components

- **API Service**: Handles communication with the trivia API, including fallback data
- **Game Controller**: Manages game state, question validation, and scoring
- **UI**: Handles DOM manipulation and user interactions
- **Proxy Server**: Manages CORS and API key for secure communication

## Dependencies

- express: ^4.18.2
- cors: ^2.8.5
- http-proxy-middleware: ^2.0.6
- http-server: ^14.1.1

## Browser Support

The game supports all modern browsers including:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

## Latest Work:
 here's what we've done:

Frontend Code Updates:
Updated API endpoints in api-service.js
Updated leaderboard endpoints in leaderboard-service.js
Updated game controller endpoints in game-controller.js
No changes needed in index.html or other frontend files
Configuration Updates:
Updated CloudFront configuration in cloudfront-config.json
Updated S3 CORS configuration in s3-cors-config.json
Updated API CORS configuration in api-cors-config.json
Updated standardized CORS configuration in standardized-cors-config.json
Updated S3 sync script in s3-sync.bat
Testing:
Created new leaderboard test file leaderboard_test_new.html
The certificate is still pending validation and the domain registration is still in progress. Once those are complete, we can:

Create the CloudFront distribution using our updated configuration
Update DNS records in Route 53
Deploy the updated frontend code to S3
Test the new domain setup

## Latest Deployment Status

- Frontend: Deployed to S3 bucket (trivia60.com)
- CloudFront: Distribution active (E19LWTBNEPF527)
- Domain: trivia60.com (Route 53)
- SSL: ACM certificate active
- API Gateway: Configured with CORS and proper routing