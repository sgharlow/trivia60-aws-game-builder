# Trivia60 Docker Deployment Plan

## Development Phase Plan

1. **Docker Setup for Local Development**
   - Create a `Dockerfile` for each API
   - Create a `docker-compose.yml` to run all three services together
   - Set up environment variables for local development
   - Configure CORS to allow localhost access

2. **Local Development Steps**:

   a. Create base `Dockerfile` template for Node.js services:
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   EXPOSE 3000
   CMD ["node", "index.js"]
   ```

   b. Create `docker-compose.yml`:
   ```yaml
   version: '3.8'
   services:
     get-questions:
       build: ./apis/get-questions
       ports:
         - "4001:4001"
       environment:
         - NODE_ENV=development
         - POSTGRES_HOST=host.docker.internal
     add-questions:
       build: ./apis/add-questions
       ports:
         - "4002:4002"
       environment:
         - NODE_ENV=development
         - POSTGRES_HOST=host.docker.internal
     leaderboard:
       build: ./apis/leaderboard
       ports:
         - "4003:4003"
       environment:
         - NODE_ENV=development
         - POSTGRES_HOST=host.docker.internal
   ```

3. **Local Testing**:
   - Run services using `docker-compose up`
   - Test API endpoints locally at:
     - http://localhost:4001 (get-questions)
     - http://localhost:4002 (add-questions)
     - http://localhost:4003 (leaderboard)
   - Update frontend to use these local endpoints during development

## Production Phase Plan

1. **AWS Infrastructure Setup**:
   - Create ECR repositories for each service
   - Set up ECS cluster
   - Create task definitions
   - Configure Application Load Balancer
   - Set up security groups and VPC

2. **Deployment Steps**:

   a. Create ECR repositories:
   ```bash
   aws ecr create-repository --repository-name trivia60-get-questions
   aws ecr create-repository --repository-name trivia60-add-questions
   aws ecr create-repository --repository-name trivia60-leaderboard
   ```

   b. Create ECS task definitions with Fargate:
   - CPU and memory configurations
   - Container definitions
   - Environment variables for production
   - IAM roles and execution roles

   c. Create ECS services:
   - Configure desired count
   - Set up auto-scaling
   - Configure load balancer rules

3. **DNS and Routing**:
   - Create subdomain for API (e.g., api.trivia60.com)
   - Configure Route53 records
   - Update CloudFront distribution to allow API domain
   - Set up SSL certificates

4. **Security and CORS**:
   - Configure CORS to allow only www.trivia60.com
   - Set up WAF rules
   - Implement rate limiting
   - Configure security groups

5. **CI/CD Pipeline**:
   - Set up GitHub Actions or AWS CodePipeline
   - Automate building and pushing Docker images
   - Automate ECS deployments
   - Implement blue-green deployment strategy
