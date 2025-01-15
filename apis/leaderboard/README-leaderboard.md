# Trivia Leaderboard API

This API provides endpoints for managing the trivia game leaderboard.

## API Details

- Base URL: `https://insert-api.execute-api.us-east-1.amazonaws.com/prod`
- API Key: `11YdHb0wqX8mWH0fbT5vD77Ml0nOviyn72wj903m`

### Endpoints

1. Get Leaderboard
   - Method: `GET`
   - Path: `/api/leaderboard`
   - Headers Required:
     - `x-api-key`: API Key (see above)

2. Submit Score
   - Method: `POST`
   - Path: `/api/leaderboard`
   - Headers Required:
     - `x-api-key`: API Key (see above)
   - Body:
     ```json
     {
       "username": "string",
       "score": number,
       "timeSpent": number
     }
     ```

### Usage Limits

- Rate limit: 100 requests per second
- Burst limit: 200 requests
- Monthly quota: 10,000 requests

### Environment Variables

The API requires the following environment variables:
- `POSTGRES_HOST`: Database host URL
- `POSTGRES_USER`: Database username
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_NAME`: Database name
- `POSTGRES_PORT`: Database port (5432)
- `ALLOWED_ORIGINS`: Allowed origins for CORS

## Prerequisites

- Node.js 18.x or later
- AWS SAM CLI
- PostgreSQL database
- AWS CLI configured with appropriate credentials
- Docker (required for local testing with SAM)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd trivia-leaderboard
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
POSTGRES_PORT=5432
ALLOWED_ORIGINS=http://localhost:3000
```

## Local Development and Testing

### Method 1: Using SAM Local (Requires Docker)

1. Make sure Docker is running on your system

2. Build the SAM application:
```bash
sam build
```

3. Start the API locally:
```bash
sam local start-api --env-vars env.json
```

This will start the API on `http://localhost:3000` by default.

### Method 2: Direct Node.js Testing (No Docker Required)

1. Start the local development server:
```bash
node index.js
```

This will start the server on port 3000 by default.

### Testing Endpoints Locally

1. Test Get Leaderboard:
```bash
# Get leaderboard entries
curl http://localhost:3000/leaderboard \
  -H "X-Api-Key: your-test-api-key"
```

2. Test Add Score:
```bash
# Add a new score
curl -X POST http://localhost:3000/set_leaderboard \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-test-api-key" \
  -d '{
    "date": "2024-12-27",
    "time": "15:30:00",
    "score": 100,
    "username": "testuser"
  }'
```

### CORS Testing

1. Test CORS preflight:
```bash
curl -X OPTIONS http://localhost:3000/leaderboard \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Api-Key"
```

2. Test CORS actual request:
```bash
curl http://localhost:3000/leaderboard \
  -H "Origin: http://localhost:3000" \
  -H "X-Api-Key: your-test-api-key"
```

### Database Testing

1. Initialize the database:
```bash
node new-database-schema.sql
```

2. Test database connection:
```bash
node test-leaderboard.js
```

### Testing with Sample Data

Use the test script to populate and verify the leaderboard:
```bash
node test-leaderboard.js
```

## API Endpoints

The API consists of two main endpoints for managing the trivia leaderboard:

### 1. Get Leaderboard Entries (`GET /leaderboard`)

Retrieves the top 10 leaderboard entries for the current date, sorted by score in ascending order.

**Request:**
```bash
curl -X GET 'https://insert-your-api-endpoint.execute-api.us-east-1.amazonaws.com/prod/leaderboard' \
-H 'x-api-key: your-api-key'
```

**Response:**
```json
[
  {
    "id": 1,
    "date": "2024-12-24",
    "time": "15:30:00",
    "score": 100,
    "username": "player1"
  },
  // ... more entries
]
```

### 2. Add Leaderboard Entry (`POST /set_leaderboard`)

Adds a new entry to the leaderboard.

**Request:**
```bash
curl -X POST 'https://insert-your-api-endpoint.execute-api.us-east-1.amazonaws.com/prod/set_leaderboard' \
-H 'x-api-key: your-api-key' \
-H 'Content-Type: application/json' \
-d '{
  "date": "2024-12-24",
  "time": "15:30:00",
  "score": 100,
  "username": "player1"
}'
```

**Request Body Parameters:**
- `date` (DATE): The date of the score entry (format: YYYY-MM-DD)
- `time` (TIME): The time of the score entry (format: HH:MM:SS)
- `score` (INTEGER): The player's score
- `username` (TEXT): The player's username

**Response:**
```json
{
  "message": "Leaderboard entry created"
}
```

## Database Schema

The leaderboard data is stored in a PostgreSQL database with the following schema:

```sql
CREATE TABLE IF NOT EXISTS public.leaderboard
(
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    time TIME NOT NULL,
    score INTEGER NOT NULL,
    username TEXT NOT NULL
);
```

**Field Descriptions:**
- `id`: Auto-incrementing unique identifier
- `date`: Date when the score was achieved
- `time`: Time when the score was achieved
- `score`: Player's score (integer value)
- `username`: Player's username (text)

## JavaScript Integration Example

Here's how to integrate the API using JavaScript:

```javascript
const API_KEY = 'your-api-key';
const BASE_URL = 'https://insert-your-api-endpoint.execute-api.us-east-1.amazonaws.com/prod';

// Get Leaderboard
async function getLeaderboard() {
  try {
    const response = await fetch(`${BASE_URL}/leaderboard`, {
      headers: {
        'x-api-key': API_KEY
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
  }
}

// Add Leaderboard Entry
async function addLeaderboardEntry(entry) {
  try {
    const response = await fetch(`${BASE_URL}/set_leaderboard`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date: entry.date,
        time: entry.time,
        score: entry.score,
        username: entry.username
      })
    });
    const data = await response.text();
    return data;
  } catch (error) {
    console.error('Error adding leaderboard entry:', error);
  }
}
```

## Error Responses

The API may return the following error responses:

- `404 Not Found`: When accessing an invalid endpoint
- `500 Internal Server Error`: When there's a server-side error (e.g., database connection issues)

All error responses will include a JSON body with a `message` field describing the error.

## CORS Support

The API implements strict CORS policies with the following settings:

### Allowed Origins
```
- http://localhost:3000
- http://localhost:8080
- https://your-own-s3-bucket.s3.us-east-1.amazonaws.com/frontend/index.html
```

### Allowed Methods
```
- GET
- POST
- PUT
- DELETE
- OPTIONS (for preflight requests)
```

### Allowed Headers
```
- Content-Type
- X-Api-Key
- Authorization
- Accept
```

### Other CORS Settings
```
- Max Age: 3600 seconds (1 hour)
- Credentials: Supported (Access-Control-Allow-Credentials: true)
```

Note: Requests from origins not in the allowed list will be rejected. Make sure your application is running on one of the allowed origins.

## Rate Limiting

To ensure fair usage and system stability, the API implements the following rate limits:

- Maximum of 10 requests per second per IP address
- Burst limit of 5 requests

## Available API Keys

The following API keys are available for use with this API:

1. **LeaderboardAPIKey**
   - Key ID: `mgtlqjhfef`
   - Value: `XXXXXXXXXXXXXXXXXXXXXXXXXX`
   - Status: Enabled

2. **LeaderboardAPIKey2**
   - Key ID: `qfcfbyvu7g`
   - Value: `your-custom-api-key-123`
   - Status: Enabled

Note: Use either of these API keys in the `x-api-key` header when making requests to the API.

## Example Usage

### Using cURL

1. Get Leaderboard:
```bash
curl -X GET 'https://insert-your-api-endpoint.execute-api.us-east-1.amazonaws.com/prod/leaderboard' \
-H 'x-api-key: your-api-key'
```

2. Add Leaderboard Entry:
```bash
curl -X POST `<insert API endpoints here>`\
-H 'x-api-key: your-api-key' \
-H 'Content-Type: application/json' \
-d '{
  "date": "2024-12-24",
  "time": "15:30:00",
  "score": 100,
  "username": "player1"
}'
```