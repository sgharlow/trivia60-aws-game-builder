# AWS Services Analysis for Trivia60

## Required Lambda Functions

1. **trivia-questions** (ACTIVE/REQUIRED)
   - Main production API for retrieving questions
   - Connected to production VPC and RDS
   - Latest modified: 2024-12-29

2. **trivia-leaderboard-v2** (ACTIVE/REQUIRED)
   - Main production leaderboard function
   - Connected to production VPC and RDS
   - Latest modified: 2024-12-30
   - CORS enabled for both www and non-www domains
   - API endpoint: https://insert-your-custom-domain.execute-api.us-east-1.amazonaws.com/prod/api/leaderboard

3. **trivia-question-generator-TriviaQuestionGeneratorF-2DEESOeBXaDN** (ACTIVE/REQUIRED)
   - Automated question generation service
   - Uses OpenAI and Reddit APIs
   - Latest modified: 2024-12-17

## Obsolete/Duplicate Lambda Functions

1. **LeaderboardFunction** (OBSOLETE)
   - Duplicate of trivia-leaderboard
   - Can be safely removed

2. **trivia-leaderboard-LeaderboardFunction-xro9pgmpfp5Q** (OBSOLETE)
   - Another duplicate of trivia-leaderboard
   - Can be safely removed

3. **trivia-get-questions-dev-api** (OBSOLETE)
   - Development version, superseded by trivia-questions
   - Can be safely removed

4. **trivia-get-questions-uat-api** (OBSOLETE)
   - UAT version, superseded by trivia-questions
   - Can be safely removed

## Required S3 Buckets

1. **your-own-s3-bucket**
   - Stores images for trivia questions
   - Created: 2024-11-29

2. **trivia60.com**
   - Main website hosting bucket
   - Created: 2024-12-27
   - Hosts both www and non-www versions
   - Latest sync: 2024-12-30

3. **trivia60-sam-artifacts**
   - SAM deployment artifacts
   - Created: 2024-12-27

## Obsolete S3 Buckets

1. **aws-sam-cli-managed-default-samclisourcebucket-aqvyil8hjgzt**
   - Generic SAM CLI bucket, can use trivia60-sam-artifacts instead
   - Can be safely removed

2. **serverless-framework-deployments-us-east-1-c202faaf-a2af**
   - Old serverless framework deployments
   - Can be safely removed if not using serverless framework

## Other AWS Resources

### VPC Configuration (Required)
- VPC ID: vpc-0336914aa71ce8587
- Subnets: subnet-0c4f0b3a1bfcdfee0, subnet-02347ccaf5502d590
- Used by all Lambda functions for RDS access

### Security Groups
Required:
- sg-08ad372f66d0bed7a (main production functions)
- sg-0d7bee950dbac80b7 (question generator)

Obsolete:
- sg-0520ace84770bc7a3 (old leaderboard)
- sg-02b1ab5edee65b0ae (duplicate leaderboard)
- sg-073c9535343c7c843 (dev/uat APIs)

### RDS
- Host: trivia-uat-infrastructure-rdsinstance-bk57cekrzk70.cnhyw40jxh6a.us-east-1.rds.amazonaws.com
- Database: trivia_db
- Currently labeled as UAT but serving as production
- Recommendation: Rename to reflect production status

### API Gateway
- Endpoint: `<insert API endpoints here>`
- API Key: uo6IrVCl7h4rPaUtS03a03BunTjCIiGn1jfKgoDQ
- CORS enabled for:
  - https://trivia60.com
  - https://www.trivia60.com

### CloudFront
- Distribution ID: E19LWTBNEPF527
- Serves both www and non-www domains
- Latest invalidation: 2024-12-30

## Cleanup Recommendations

1. Delete obsolete Lambda functions:
   - LeaderboardFunction
   - trivia-leaderboard-LeaderboardFunction-xro9pgmpfp5Q
   - trivia-get-questions-dev-api
   - trivia-get-questions-uat-api

2. Remove unused S3 buckets:
   - aws-sam-cli-managed-default-samclisourcebucket-aqvyil8hjgzt
   - serverless-framework-deployments-us-east-1-c202faaf-a2af

3. Clean up security groups:
   - Remove all obsolete security groups after confirming no dependencies

4. RDS Changes:
   - Consider renaming the RDS instance to reflect its production status

## Recent Changes
- 2024-12-30: Updated leaderboard Lambda function with CORS support for both domains
- 2024-12-30: Updated frontend code to use direct API Gateway URL
- 2024-12-30: Deployed latest changes to S3 and invalidated CloudFront cache

## Next Steps Required
1. Complete S3 bucket versioning cleanup
2. Delete identified IAM roles after verifying no dependencies
3. Review and update security group rules to reflect current needs
4. Plan RDS changes with database administrator
5. DNS Cleanup:
   - Identified active zone (Z02736992ZHWGJ5ZMQZCS)
   - Deleted redundant zone (Z0273727FSSKYAQOOES0)
6. Certificate cleanup:
   - Delete failed `vpn.dev.internal` certificate
   - Added validation record for `api.trivia60.com` certificate
7. CloudWatch cleanup:
   - Deleted obsolete Lambda log groups
   - Verified no obsolete EventBridge rules
8. API Gateway and Lambda:
   - Created new leaderboard Lambda function with RDS access
   - Updated API Gateway endpoints
   - Deployed changes to production
