# Trivia Questions API

A secure, serverless API built with AWS Lambda and Express.js for serving trivia questions. The API includes authentication, rate limiting, and comprehensive monitoring.

## Features

- Serverless architecture using AWS Lambda
- API Key authentication
- Rate limiting and usage plans
- CORS support
- Database integration with PostgreSQL
- Health check endpoint
- Comprehensive error handling and monitoring
- TypeScript support
- Local development environment

## API Details

- Base URL: `https://insert-your-api-id.execute-api.us-east-1.amazonaws.com/prod`
- API Key: `CEAFrRNaJoiq0gzDA7iw73S2ymv0ILO6lGQwvgOj`

### Endpoints

1. Get Questions
   - Method: `GET`
   - Path: `/api/questions`
   - Headers Required:
     - `x-api-key`: API Key (see above)

2. Health Check
   - Method: `GET`
   - Path: `/health`
   - Headers Required:
     - `x-api-key`: API Key (see above)

### Usage Limits

- Rate limit: 100 requests per second
- Burst limit: 200 requests
- Monthly quota: 10,000 requests

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- PostgreSQL database
- Serverless Framework CLI (`npm install -g serverless`)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd trivia-get-questions
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your configuration:
```env
POSTGRES_HOST=your_POSTGRES_HOST
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
POSTGRES_NAME=your_db_name
POSTGRES_PORT=your_POSTGRES_PORT
ALLOWED_ORIGINS=http://localhost:3000
NODE_ENV=prod
```

## Local Development and Testing

### Starting the Local Server

1. Start the local development server:
```bash
npm start
```
This will start the server on port 4001 by default.

2. For serverless offline testing:
```bash
serverless offline start
```
This provides a more production-like environment with Lambda simulation.

### Testing the API Locally

1. Test the health endpoint:
```bash
curl http://localhost:4001/health
```

2. Test the questions endpoint:
```bash
curl http://localhost:4001/api/questions \
  -H "X-Api-Key: your-test-api-key" \
  -H "Content-Type: application/json"
```

3. Test with the provided test events:
```bash
# Using the test events
node local-lambda.js ./events/get-questions.json
```

### CORS Testing

1. Test CORS preflight:
```bash
curl -X OPTIONS http://localhost:4001/api/questions \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Api-Key"
```

2. Test CORS actual request:
```bash
curl http://localhost:4001/api/questions \
  -H "Origin: http://localhost:3000" \
  -H "X-Api-Key: your-test-api-key"
```

### Database Testing

1. Test database connection:
```bash
node setup-db.js
```

2. Run database migrations:
```bash
node migrations/run.js
```

### Automated Testing

Run the test suite:
```bash
npm test
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| POSTGRES_HOST | PostgreSQL host | - |
| POSTGRES_USER | Database username | - |
| POSTGRES_PASSWORD | Database password | - |
| POSTGRES_NAME | Database name | - |
| POSTGRES_PORT | Database port | 5432 |
| ALLOWED_ORIGINS | Comma-separated list of allowed origins | http://localhost:3000 |
| NODE_ENV | Environment variable for the stage | prod |

## API Documentation

### GET /health
Health check endpoint to verify API status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-27T..."
}
```

### GET /api/questions
Retrieve trivia questions.

**Headers:**
- X-Api-Key: Required for authentication
- Content-Type: application/json

**Response:**
```json
{
  "questions": [
    {
      "question_id": 1,
      "question": "Sample question?",
      "answers": ["Answer 1", "Answer 2", "Answer 3", "Answer 4"],
      "correct_answer": 0
    }
  ]
}
```

## Error Handling

The API returns standard HTTP status codes and JSON error messages:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-12-27T..."
}
```

Common error codes:
- 400: Bad Request
- 401: Unauthorized (missing or invalid API key)
- 403: Forbidden
- 429: Too Many Requests
- 500: Internal Server Error

## Project Structure

```
trivia-get-questions/
├── events/              # Test event templates
├── migrations/          # Database migrations
├── node_modules/        # Dependencies
├── .env                 # Environment variables
├── .env.example         # Example environment file
├── index.js            # Main application logic
├── lambda.js           # AWS Lambda handler
├── local-lambda.js     # Local development server
├── package.json        # Project dependencies
├── serverless.yml      # Serverless configuration
└── README.md           # Documentation
```

#Progress
12/29 (progress5): the questions api is now working properly and does not encounter CORS errors. the leaderboard API does encoutner CORs errors. beginning work on this now.