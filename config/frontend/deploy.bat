@echo off
echo Building and deploying React app...

REM Set variables
set BUCKET_NAME=trivia60.com
set DISTRIBUTION_ID=yourid
set REGION=us-east-1

REM Build React app
call npm run build

REM Sync to S3
aws s3 sync build/ s3://%BUCKET_NAME% --delete --region %REGION%

REM Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id %DISTRIBUTION_ID% --paths "/*"

echo Deployment complete!
pause
