# Add Questions API

This API generates trivia questions using OpenAI's GPT-4 and DALL-E models, based on trending topics from Reddit. It's designed to run as a one-time process that generates a specified number of questions and saves them to a PostgreSQL database.

## Features

- Generates trivia questions using GPT-4
- Creates visual hints using DALL-E
- Sources topics from Reddit's trending posts
- Stores questions and images in PostgreSQL and AWS S3
- Includes question validation and duplicate checking
- Configurable rate limiting and retry logic

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15
- AWS S3 bucket
- OpenAI API key
- Reddit API credentials

## Environment Variables

Create a `.env` or `.env.production` file with the following variables:

```env
# Database
POSTGRES_HOST=postgres
POSTGRES_USER=api_service
POSTGRES_PASSWORD=your_password
POSTGRES_NAME=trivia_db
POSTGRES_PORT=5432

# AWS
AWS_REGION=your_region
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name

# OpenAI
OPENAI_API_KEY=your_openai_key

# Reddit
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
```

## Database Schema

The PostgreSQL database uses the following schema:

```sql
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    incorrect_answers TEXT[] NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    source TEXT,
    hint_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Docker Configuration

### Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
```

### docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: api_service
      POSTGRES_PASSWORD: XXXXXXXXXXXXXXXXXXXXXXXXXX
      POSTGRES_DB: trivia_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - trivia-network

  add-questions:
    build: .
    env_file: .env.production
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=postgres
    depends_on:
      - postgres
    networks:
      - trivia-network

networks:
  trivia-network:
    name: trivia-network

volumes:
  postgres_data:
```

## Usage

1. Set up environment variables in `.env.production`
2. Run the API using Docker Compose:
   ```bash
   docker compose up --build
   ```

The API will:
1. Connect to the PostgreSQL database
2. Fetch trending topics from Reddit
3. Generate questions using GPT-4
4. Create visual hints using DALL-E
5. Save questions and images to the database and S3
6. Exit after completion

## Configuration Options

The following options can be configured in `index.js`:

```javascript
const CONFIG = {
    QUESTIONS_PER_DAY: 2,        // Number of questions to generate
    RATE_LIMIT_DELAY: 2000,      // Delay between API calls (ms)
    MAX_RETRIES: 3,              // Maximum retry attempts
    RETRY_DELAY: 1000,           // Delay between retries (ms)
    BATCH_SIZE: 2                // Questions per batch
};
```

## Error Handling

The API includes comprehensive error handling:
- Database connection errors
- API rate limiting
- Content validation
- Duplicate question detection
- Image generation failures

## Logging

The API logs important events and errors to help with monitoring and debugging:
- Process start and completion
- Question generation progress
- Database operations
- Error details

## Development

For local development:
1. Install dependencies: `npm install`
2. Set up environment variables in `.env`
3. Run the API: `node index.js`

## Production Deployment

The API is designed to run as a scheduled task:
1. Deploy using Docker Compose
2. Set up a cron job or scheduler to run the container daily
3. Monitor logs for errors and completion status

## Note

This API is designed to run once and exit. It does not include a web server or API endpoints, as it's meant to be run as a scheduled task to generate questions periodically.
