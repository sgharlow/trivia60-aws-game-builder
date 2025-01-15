const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

exports.handler = async (event) => {
    // Validate and get the correct origin
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5000',
        'https://your-own-s3-bucket.s3.us-east-1.amazonaws.com',
        'http://your-own-s3-bucket.s3.us-east-1.amazonaws.com'
    ];
    const origin = event.headers?.origin || event.headers?.Origin;
    const validOrigin = allowedOrigins.includes(origin) ? origin : 'https://your-own-s3-bucket.s3.us-east-1.amazonaws.com';

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': validOrigin,
        'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Preflight': 'false',
        'Access-Control-Options-Status': '204'
    };

    // Handle OPTIONS request (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        // Call the original Lambda function
        const params = {
            FunctionName: 'trivia-get-questions-uat-api',
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(event)
        };
        
        const result = await lambda.invoke(params).promise();
        
        // Check if Lambda execution failed
        if (result.FunctionError) {
            console.error('Lambda execution failed:', result.Payload);
            throw new Error('Lambda execution failed');
        }

        const response = JSON.parse(result.Payload);
        
        // Add CORS headers to successful response
        return {
            statusCode: response.statusCode || 200,
            headers: corsHeaders,
            body: typeof response.body === 'string' ? response.body : JSON.stringify(response)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Internal Server Error',
                message: error.message
            })
        };
    }
};
