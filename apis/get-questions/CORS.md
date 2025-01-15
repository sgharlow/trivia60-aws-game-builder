# CORS Configuration Guide

This document outlines the CORS (Cross-Origin Resource Sharing) settings for the Trivia Application across different AWS services.

## Overview

The Trivia Application uses a standardized CORS configuration across its components to ensure secure cross-origin communication between:
- Frontend application (running on localhost)
- API Gateway endpoints
- S3 bucket for image storage

## Standardized CORS Settings

### Allowed Origins
```
- http://localhost:3000
- http://localhost:8080
- https://us-east-1.console.aws.amazon.com
- https://owgl4487w7.execute-api.us-east-1.amazonaws.com
- https://ymgo3oa6j3.execute-api.us-east-1.amazonaws.com
- https://api.trivia.codeium.com
- https://trivia.codeium.com
```

### Allowed Methods
```
- GET
- OPTIONS (for preflight requests)
```

### Allowed Headers
```
- Content-Type
- X-Api-Key
- Authorization
- Accept
```

### Other Settings
```
- Max Age: 300 seconds (5 minutes)
- Credentials: Supported
```

## Service-Specific Configurations

### 1. API Gateway (owgl4487w7.execute-api.us-east-1.amazonaws.com)

#### GET Method Response Headers
```json
{
    "method.response.header.Access-Control-Allow-Origin": true,
    "method.response.header.Access-Control-Allow-Headers": true,
    "method.response.header.Access-Control-Allow-Methods": true
}
```

#### OPTIONS Method Response Headers
```json
{
    "method.response.header.Access-Control-Allow-Origin": true,
    "method.response.header.Access-Control-Allow-Headers": true,
    "method.response.header.Access-Control-Allow-Methods": true,
    "method.response.header.Access-Control-Max-Age": true
}
```

#### Integration Response Values
```json
{
    "method.response.header.Access-Control-Allow-Origin": "'http://localhost:3000,http://localhost:8080,https://us-east-1.console.aws.amazon.com,https://owgl4487w7.execute-api.us-east-1.amazonaws.com,https://ymgo3oa6j3.execute-api.us-east-1.amazonaws.com,https://api.trivia.codeium.com,https://trivia.codeium.com'",
    "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Api-Key,Authorization,Accept'",
    "method.response.header.Access-Control-Allow-Methods": "'GET,OPTIONS'",
    "method.response.header.Access-Control-Max-Age": "'300'"
}
```

### 2. S3 Bucket (your-own-s3-bucket)

```json
{
    "CORSRules": [
        {
            "AllowedHeaders": [
                "Content-Type",
                "X-Api-Key",
                "Authorization",
                "Accept"
            ],
            "AllowedMethods": [
                "GET"
            ],
            "AllowedOrigins": [
                "http://localhost:3000",
                "http://localhost:8080",
                "https://us-east-1.console.aws.amazon.com",
                "https://owgl4487w7.execute-api.us-east-1.amazonaws.com",
                "https://ymgo3oa6j3.execute-api.us-east-1.amazonaws.com",
                "https://api.trivia.codeium.com",
                "https://trivia.codeium.com"
            ],
            "ExposeHeaders": [],
            "MaxAgeSeconds": 300
        }
    ]
}
```

## Testing CORS Configuration

### Test OPTIONS (Preflight) Request
```bash
curl -X OPTIONS -i "https://owgl4487w7.execute-api.us-east-1.amazonaws.com/uat/api/questions" \
-H "Origin: http://localhost:3000" \
-H "Access-Control-Request-Method: GET" \
-H "Access-Control-Request-Headers: Content-Type,X-Api-Key,Authorization,Accept"
```

### Test GET Request
```bash
curl -X GET -i "https://owgl4487w7.execute-api.us-east-1.amazonaws.com/uat/api/questions" \
-H "Origin: http://localhost:3000" \
-H "X-Api-Key: uqmTPkvbIp6bazDeV7SlDaC3hbrY0xbb8qrN4pjO" \
-H "Content-Type: application/json"
```

## PowerShell Commands

### Test OPTIONS (Preflight) Request
```powershell
curl.exe -X OPTIONS -i "https://owgl4487w7.execute-api.us-east-1.amazonaws.com/uat/api/questions" `
-H "Origin: http://localhost:3000" `
-H "Access-Control-Request-Method: GET" `
-H "Access-Control-Request-Headers: Content-Type,X-Api-Key,Authorization,Accept"
```

### Test GET Request
```powershell
curl.exe -X GET -i "https://owgl4487w7.execute-api.us-east-1.amazonaws.com/uat/api/questions" `
-H "Origin: http://localhost:3000" `
-H "X-Api-Key: uqmTPkvbIp6bazDeV7SlDaC3hbrY0xbb8qrN4pjO" `
-H "Content-Type: application/json"
```

## Important Notes

1. API Key Requirements:
   - OPTIONS method: No API key required
   - GET method: API key required

2. Security Considerations:
   - Specific origins are listed instead of using wildcards (*)
   - Only necessary HTTP methods are allowed
   - Headers are explicitly defined
   - CORS preflight responses are cached for 5 minutes

3. Troubleshooting:
   - Ensure all CORS headers are present in both method response and integration response
   - Check that the API key is included for GET requests
   - Verify that the origin matches one of the allowed origins exactly
