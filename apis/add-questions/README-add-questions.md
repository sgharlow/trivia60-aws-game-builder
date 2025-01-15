# AI Trivia Question Generator

An intelligent Node.js application that automatically generates high-quality trivia questions by analyzing trending topics from Reddit and using OpenAI's GPT-4 and DALL-E models to create engaging questions, answers, and visual hints.

## Features

- **Automated Content Generation**
  - Fetches real-time trending topics from Reddit's most popular posts
  - Generates contextually relevant trivia questions using OpenAI's GPT-4
  - Creates visual hints using DALL-E 3 AI image generation
  - Produces multiple-choice format with one correct and three incorrect answers
  - Includes both text and image hints for each question

- **Cloud Storage Integration**
  - Stores questions and metadata in PostgreSQL database
  - Uploads AI-generated hint images to AWS S3
  - Generates secure, time-limited signed URLs for image access
  - Maintains data consistency across storage systems

- **Smart Content Processing**
  - Filters and processes Reddit trends for question generation
  - Creates engaging, educational questions from current events
  - Generates relevant visual hints that don't directly reveal answers
  - Handles various content types (news, images, videos, discussions)

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- AWS account with S3 access
- OpenAI API key
- Reddit API credentials (client ID and secret)

## Setup Instructions

1. **Clone and Install Dependencies**
   ```bash
   git clone [repository-url]
   cd trivia-add-questions
   npm install
   ```

2. **Environment Configuration**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Configure the following variables in `.env`:
     ```
     # Database Configuration
     POSTGRES_HOST=your-db-host.region.rds.amazonaws.com
     POSTGRES_USER=your_db_user
     POSTGRES_PASSWORD=your_db_password
     POSTGRES_NAME=your_db_name
     POSTGRES_PORT=5432

     # AWS Configuration
     AWS_ACCESS_KEY_ID=your_aws_access_key_id
     AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
     AWS_REGION=us-east-1
     S3_BUCKET_NAME=your-s3-bucket-name

     # OpenAI API Key
     OPENAI_API_KEY=your_openai_api_key

     # Reddit API Configuration
     REDDIT_CLIENT_ID=your_reddit_client_id
     REDDIT_CLIENT_SECRET=your_reddit_client_secret

     # Optional Configuration
     QUESTIONS_PER_DAY=10  # Default number of questions to generate per day
     LOG_LEVEL=info       # Logging level (debug, info, warn, error)
     ```

## Running the Application

### Generate New Questions
To generate new trivia questions from current Reddit trends:
```bash
npm start
```

The process will:
1. Fetch the current top trending posts from Reddit
2. Generate a trivia question for each trend using GPT-4
3. Create a visual hint using DALL-E
4. Upload the hint image to S3
5. Store the question, answers, and hints in the database

### Check Database Contents
To view the questions stored in the database:
```bash
node check-db.js
```

## Question Generation Process

Each generated question includes:
1. **Main Question**
   - Contextually relevant to the trending topic
   - Clear and unambiguous wording
   - Educational value

2. **Answer Options**
   - One correct answer
   - Three plausible but incorrect answers
   - All options are distinct and clear

3. **Hints**
   - Text hint providing a clue without revealing the answer
   - AI-generated image hint using DALL-E
   - S3-hosted image with secure access URL

## Output Format

Example question output:
```javascript
{
  "question": "What is the phrase 'Everyone liked that' in the game 'Fallout: New Vegas' associated with?",
  "correct_answer": "Making a decision that is universally favored",
  "incorrect_answers": [
    "Defeating a difficult enemy",
    "Finding a rare item",
    "Completing a game level"
  ],
  "hint": "This phrase pops up when you make a choice that is applauded by all in the game.",
  "hint_image_url": "https://[s3-bucket-url]/hints/[image-id].png"
}
```

## Troubleshooting

Common issues and solutions:

1. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check database credentials in .env
   - Ensure database port is accessible

2. **API Rate Limits**
   - Monitor OpenAI API usage
   - Check Reddit API rate limits
   - Adjust QUESTIONS_PER_DAY if needed

3. **Image Generation Failures**
   - Verify OpenAI API key permissions
   - Check S3 bucket permissions
   - Monitor DALL-E service status

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
## Latest Status
The Lambda function is now working perfectly! Let's summarize what we've accomplished:

Successfully connected to RDS database by:
Created a new parameter group trivia-uat-pg16
Applied the parameter group to the RDS instance
Configured security groups to allow Lambda to connect to RDS
Fixed Reddit API authentication by:
Added the correct Reddit client ID and secret to Lambda environment variables
Successfully fetching trending topics from Reddit
Image generation and storage:
Successfully generating images using DALL-E
Uploading images to S3 bucket
Managing rate limits by implementing retries
The Lambda function is now:

Fetching trending topics from Reddit
Generating trivia questions based on those topics
Creating images for each question using DALL-E
Storing the images in S3
Saving the questions to the RDS database
The function is running asynchronously and will continue to generate questions. You can monitor its progress in the CloudWatch logs.
## License

This project is licensed under the MIT License - see the LICENSE file for details.
