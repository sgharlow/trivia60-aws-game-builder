# CORS Solution for Trivia Frontend Project

## Current Problem
The project currently faces CORS issues when calling the leaderboard API from the S3-hosted frontend. This is due to the distributed nature of the application:
- Frontend: Hosted on S3 (https://your-own-s3-bucket.s3-website-us-east-1.amazonaws.com)
- API: AWS Lambda + API Gateway (https://insert-api.execute-api.us-east-1.amazonaws.com/uat)

## Current CORS Configuration
CORS is configured through CloudFront, allowing cross-origin requests from the frontend hosted on S3. The following headers are set:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS, POST, PUT, DELETE`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Recommended Solution
After analyzing the various approaches, the most reliable solution is to implement a CloudFront distribution in front of both the S3 bucket and the API Gateway. This approach has several advantages:
1. Single domain for all resources
2. Simplified CORS configuration
3. Better performance through CDN caching
4. Enhanced security

## Implementation Plan

### 1. CloudFront Distribution Setup

1. Create a new CloudFront distribution
   ```
   AWS Console > CloudFront > Create Distribution
   ```

2. Configure Origins:
   - Origin 1 (Static Website):
     ```
     Origin Domain: your-own-s3-bucket.s3-website-us-east-1.amazonaws.com
     Origin Path: /
     Origin ID: S3-Website
     Protocol Policy: HTTP Only
     ```
   
   - Origin 2 (API):
     ```
     Origin Domain: insert-api.execute-api.us-east-1.amazonaws.com
     Origin Path: /uat
     Origin ID: API-Gateway
     Protocol Policy: HTTPS Only
     ```

3. Configure Behaviors:
   - Default (*) -> S3-Website:
     ```
     Path Pattern: *
     Origin: S3-Website
     Viewer Protocol Policy: Redirect HTTP to HTTPS
     Allowed HTTP Methods: GET, HEAD, OPTIONS
     Cache Policy: CachingOptimized
     ```
   
   - API Path (/api/*) -> API-Gateway:
     ```
     Path Pattern: /api/*
     Origin: API-Gateway
     Viewer Protocol Policy: HTTPS Only
     Allowed HTTP Methods: ALL
     Cache Policy: CachingDisabled
     Origin Request Policy: AllViewerExceptHostHeader
     ```

### 2. API Gateway Updates

1. Remove existing CORS configuration from API Gateway
2. Update the API endpoint path to include '/api':
   ```
   Current: /get_leaderboard
   New: /api/get_leaderboard
   ```

3. Update Lambda function response headers:
   ```javascript
   const response = {
     statusCode: 200,
     headers: {
       'Content-Type': 'application/json'
     },
     body: JSON.stringify(data)
   };
   ```

### 3. Frontend Code Updates

1. Update API endpoint URLs in frontend code:
   ```javascript
   // Before
   const API_URL = `<insert API endpoints here>`
   
   // After
   const API_URL = 'https://[your-cloudfront-domain]/api';
   ```

2. Simplify fetch requests:
   ```javascript
   const response = await fetch(`${API_URL}/get_leaderboard`, {
     method: 'GET',
     headers: {
       'X-Api-Key': process.env.LEADERBOARD_API_KEY,
       'Accept': 'application/json'
     }
   });
   ```

### 4. Environment Updates

1. Update `.env` file:
   ```
   # API Configuration
   API_URL=https://[your-cloudfront-domain]/api
   LEADERBOARD_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

### 5. S3 Bucket Updates

1. Update S3 bucket policy to allow CloudFront access:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowCloudFrontAccess",
         "Effect": "Allow",
         "Principal": {
           "Service": "cloudfront.amazonaws.com"
         },
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-own-s3-bucket/*",
         "Condition": {
           "StringEquals": {
             "AWS:SourceArn": "arn:aws:cloudfront::[your-account-id]:distribution/[distribution-id]"
           }
         }
       }
     ]
   }
   ```

## Implementation Steps

1. **CloudFront Setup (30 minutes)**
   - Create CloudFront distribution
   - Configure origins and behaviors
   - Note the CloudFront domain name

2. **API Updates (15 minutes)**
   - Update API Gateway configuration
   - Deploy API changes

3. **Frontend Updates (30 minutes)**
   - Update all API endpoint references
   - Update environment variables
   - Test locally

4. **S3 and Security Updates (15 minutes)**
   - Update S3 bucket policy
   - Verify CloudFront access

5. **Testing (30 minutes)**
   - Test all API endpoints through CloudFront
   - Verify CORS issues are resolved
   - Test with different browsers

## Rollback Plan

If issues occur:
1. Keep the old S3 and API Gateway endpoints active
2. Point DNS back to original endpoints
3. Remove CloudFront distribution
4. Restore original CORS configurations

## Monitoring

After implementation:
1. Monitor CloudFront metrics for errors
2. Check API Gateway logs for any issues
3. Monitor browser console for CORS errors

## Success Criteria

1. No CORS errors in browser console
2. All API calls successful through CloudFront
3. Website loads and functions correctly
4. Leaderboard functionality works as expected

## Support Notes

If you encounter any issues during implementation:
1. Check CloudFront distribution status
2. Verify origin configurations
3. Check API Gateway logs
4. Verify S3 bucket permissions
