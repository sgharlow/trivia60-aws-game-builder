@echo off
echo Syncing frontend files to S3...

REM Set variables
set BUCKET_NAME=trivia60.com
set DISTRIBUTION_ID=your-id
set REGION=us-east-1

REM Navigate to frontend directory and build the project
cd frontend
call npm run build

REM Sync frontend files to S3 (excluding node_modules and other development files)
aws s3 sync . s3://%BUCKET_NAME% --delete --region %REGION% --exclude "node_modules/*" --exclude "package*.json" --exclude ".env*" --exclude "scripts/*" --exclude "server.js"

REM Create CloudFront invalidation
aws cloudfront create-invalidation --distribution-id %DISTRIBUTION_ID% --paths "/*"

echo Sync complete!
pause
