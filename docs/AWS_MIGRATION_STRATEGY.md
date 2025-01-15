# Trivia60 AWS Migration Strategy

## Architecture Overview
Current Architecture: Multi-service Docker Compose setup
Target Architecture: AWS ECS with Fargate and Complementary AWS Services

## Migration Components

### 1. Containerization Preparation
- [ ] Optimize Dockerfiles for cloud deployment
- [ ] Create `.dockerignore` files to reduce image size
- [ ] Implement multi-stage builds for smaller images

### 2. Database Migration
- **Retain Containerized PostgreSQL**
  - Use existing Docker PostgreSQL configuration
  - Implement persistent volume strategy in Fargate
  - Use EFS (Elastic File System) for data persistence
  - Configure backup and recovery mechanisms

#### PostgreSQL Persistence Strategy

##### Data Durability Challenges in Serverless Containers
- Ephemeral container storage
- Risk of data loss during restarts
- Limited persistent storage options

##### Proposed Solution: Hybrid Persistence Approach
1. **Primary Storage**: AWS Elastic File System (EFS)
   - Provides persistent, scalable file storage
   - Seamless integration with Fargate
   - Maintains data across container lifecycle

2. **Backup Mechanism**: S3 Periodic Snapshots
   - Automated database dumps
   - Point-in-time recovery capability
   - Low-cost long-term storage

##### Implementation Details
- **Volume Mounting**
  ```yaml
  volumes:
    - efs-postgres-data:/var/lib/postgresql/data
  ```

- **Backup Script** (Automated)
  ```bash
  #!/bin/bash
  # Daily database backup
  BACKUP_DIR="/mnt/backups/postgres"
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  pg_dump -U postgres trivia_db > "${BACKUP_DIR}/trivia_db_${TIMESTAMP}.sql"
  aws s3 cp "${BACKUP_DIR}/trivia_db_${TIMESTAMP}.sql" s3://trivia60-backups/
  ```

- **Recovery Mechanism**
  ```bash
  #!/bin/bash
  # Automatic database initialization
  if [ ! "$(ls -A /var/lib/postgresql/data)" ]; then
    # Restore from latest S3 backup
    LATEST_BACKUP=$(aws s3 ls s3://trivia60-backups/ | sort | tail -n 1)
    if [ -n "$LATEST_BACKUP" ]; then
      aws s3 cp "s3://trivia60-backups/$LATEST_BACKUP" /tmp/restore.sql
      psql -U postgres -d trivia_db -f /tmp/restore.sql
    else
      # Fallback to initial schema
      psql -U postgres -d trivia_db -f /docker-entrypoint-initdb.d/init.sql
    fi
  fi
  ```

##### Monitoring and Reliability
- CloudWatch Metrics Tracking
  - Database size
  - Backup frequency
  - Restoration attempts
- Comprehensive health checks
  ```yaml
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 30s
    timeout: 10s
    retries: 5
  ```

##### Cost Considerations
- EFS Storage: ~$0.30 per GB-month
- S3 Backup Storage: ~$0.023 per GB-month
- Estimated Monthly Cost: $5-$20

##### Risk Mitigation
1. Data Corruption Prevention
   - Regular integrity checks
   - Multiple backup generations
2. Performance Optimization
   - EFS Provisioned Throughput mode
   - Continuous performance monitoring

#### PostgreSQL Container Considerations:
- Maintain current Postgres 16 configuration
- Implement volume persistence
- Set up regular backups
- Ensure high availability

### 3. Networking Strategy
- Create VPC with public and private subnets
- Implement AWS Security Groups
- Use Application Load Balancer (ALB) for routing
- Configure Route 53 for `trivia60.com` domain routing

### 4. Container Orchestration (ECS Fargate)
- Create ECS Cluster
- Define task definitions for each service
  - `get-questions`
  - `add-questions`
  - `monitor`
- Use AWS Parameter Store for environment variables
- Implement service discovery

### 5. Continuous Deployment
- Set up AWS CodePipeline
- Create CodeBuild projects
- Implement GitHub/CodeCommit integration
- Configure automatic deployments

### 6. Monitoring and Observability
- CloudWatch Logs for container logs
- CloudWatch Metrics for performance tracking
- AWS X-Ray for distributed tracing
- Set up CloudWatch Alarms

### 7. Security Considerations
- Implement IAM Roles with least privilege
- Use AWS Secrets Manager for sensitive configurations
- Enable VPC Flow Logs
- Set up AWS WAF for web application protection

## Implemented Architecture
The application has been successfully migrated to AWS using the following services:

### ECS Cluster
- **Cluster Name**: `Trivia60-Cluster`
- **Cluster ARN**: `arn:aws:ecs:us-east-1:461293170793:cluster/Trivia60-Cluster`

### ECS Services
1. **Frontend Service**
   - **Name**: `Trivia60-Frontend`
   - **ARN**: `arn:aws:ecs:us-east-1:461293170793:service/Trivia60-Cluster/Trivia60-Frontend`
   - **Port**: 80
   - **Target Group ARN**: `arn:aws:elasticloadbalancing:us-east-1:461293170793:targetgroup/Trivia60-Frontend/5469fd053d02bfd4`

2. **GetQuestions Service**
   - **Name**: `Trivia60-GetQuestions`
   - **ARN**: `arn:aws:ecs:us-east-1:461293170793:service/Trivia60-Cluster/Trivia60-GetQuestions`
   - **Port**: 4001
   - **Target Group ARN**: `arn:aws:elasticloadbalancing:us-east-1:461293170793:targetgroup/Trivia60-GetQuestions/bc0ccc19f9cd08b5`

3. **AddQuestions Service**
   - **Name**: `Trivia60-AddQuestions`
   - **ARN**: `arn:aws:ecs:us-east-1:461293170793:service/Trivia60-Cluster/Trivia60-AddQuestions`
   - **Port**: 4002
   - **Target Group ARN**: `arn:aws:elasticloadbalancing:us-east-1:461293170793:targetgroup/Trivia60-AddQuestions/4a9d1715741d8eed`

4. **Leaderboard Service**
   - **Name**: `Trivia60-Leaderboard`
   - **ARN**: `arn:aws:ecs:us-east-1:461293170793:service/Trivia60-Cluster/Trivia60-Leaderboard`
   - **Port**: 4003
   - **Target Group ARN**: `arn:aws:elasticloadbalancing:us-east-1:461293170793:targetgroup/Trivia60-Leaderboard/3107ed5be2c2881b`

5. **Monitor Service**
   - **Name**: `Trivia60-Monitor`
   - **ARN**: `arn:aws:ecs:us-east-1:461293170793:service/Trivia60-Cluster/Trivia60-Monitor`
   - **Port**: 4004
   - **Target Group ARN**: `arn:aws:elasticloadbalancing:us-east-1:461293170793:targetgroup/Trivia60-Monitor/0f217f2fdbb741ee`

6. **PostgreSQL Service**
   - **Name**: `Trivia60-PostgreSQL`
   - **ARN**: `arn:aws:ecs:us-east-1:461293170793:service/Trivia60-Cluster/Trivia60-PostgreSQL`
   - **Port**: 5432

### Networking
- **VPC Subnets**: 
  - `subnet-0c4f0b3a1bfcdfee0`
  - `subnet-02347ccaf5502d590`
- **Security Group**: `sg-08ad372f66d0bed7a`

### Monitoring
All services have CloudWatch alarms configured for:
- CPU Utilization (>80%)
- Memory Utilization (>80%)
- Service Health (Running Task Count)
- Target Group Health (for services behind ALB)

### SNS Notifications
- **Topic ARN**: `arn:aws:sns:us-east-1:461293170793:Trivia60-Alerts`

### Storage
- **EFS Mount Points**: Configured for PostgreSQL data persistence
- **EFS Access Points**: Created in the correct VPC and subnet

## Migration Status
 All services have been successfully migrated to AWS ECS Fargate
 Networking and security groups configured
 CloudWatch monitoring and alarms set up
 PostgreSQL persistence implemented using EFS

## Next Steps
1. Monitor service stability and performance
2. Fine-tune alarm thresholds based on actual usage
3. Implement automated backup strategy for PostgreSQL
4. Set up CI/CD pipeline for automated deployments

## Migration Steps

### Preparation
1. Create AWS Account (if not existing)
2. Install AWS CLI and configure credentials
3. Create IAM user with necessary permissions

### Database Migration
1. Update Docker PostgreSQL configuration
2. Implement persistent volume strategy in Fargate
3. Configure backup and recovery mechanisms

### Container Deployment
1. Create ECR repositories for each service
2. Build and push Docker images
3. Create ECS task definitions
4. Set up Fargate services

### Networking
1. Configure VPC
2. Set up security groups
3. Configure ALB
4. Update DNS records

### Continuous Integration
1. Set up CodePipeline
2. Configure build and deployment stages
3. Implement automated testing

## Estimated Migration Effort
- Complexity: Medium
- Estimated Time: 2-4 weeks
- Recommended Team: 
  - 1 DevOps Engineer
  - 1 Backend Developer

## Cost Estimation for 20 Concurrent Users

### Comprehensive Cost Breakdown

#### Compute Costs (AWS Fargate)
| Service | Resources | Hourly Cost | Daily Cost |
|---------|-----------|-------------|------------|
| `get-questions` | 0.25 vCPU, 0.5GB RAM | $0.01344 | $0.32 |
| `postgres` | 0.5 vCPU, 2GB RAM | $0.04672 | $1.12 |
| `monitor` | 0.25 vCPU, 0.5GB RAM | $0.01344 | $0.32 |

**Total Daily Compute Cost: $1.77**

#### Storage Costs

##### 1. Elastic File System (EFS)
- Estimated Database Size: 5GB
- Storage Rate: $0.30 per GB-month
- **Daily EFS Cost: $0.05**

##### 2. S3 Backup Storage
- Daily Backup Size: ~100MB
- Storage Rate: $0.023 per GB-month
- **Daily S3 Cost: Negligible (<$0.01)**

#### Networking Costs
- Application Load Balancer
  - Hourly Cost: $0.0225
  - **Daily Networking Cost: $0.54**

#### Data Transfer
- Estimated Daily Transfer: 500MB
- First 100GB/month free
- Additional Transfer Rate: $0.09 per GB
- **Daily Data Transfer Cost: $0.045**

### Total Estimated Costs
| Cost Category | Daily | Monthly |
|--------------|-------|---------|
| Compute | $1.77 | $53.10 |
| Storage | $0.05 | $1.50 |
| Backups | $0.01 | $0.30 |
| Data Transfer | $0.045 | $1.35 |
| Networking | $0.54 | $16.20 |
| **Total** | **$2.42** | **$72.60**

### Cost Optimization Strategies
1. **Fargate Spot Instances**
   - Potential cost reduction: Up to 70%
   - Ideal for non-critical, interruptible workloads
   - Recommended for development and testing environments

2. **Auto-Scaling**
   - Implement dynamic scaling based on user load
   - Reduce resources during low-traffic periods
   - Potential savings: 20-40% of compute costs

3. **Reserved Instances**
   - Commit to 1-3 year terms for significant discounts
   - Best for predictable, consistent workloads
   - Potential savings: Up to 75% compared to on-demand pricing

### Cost Monitoring Recommendations
- Set up AWS Cost Explorer
- Configure CloudWatch billing alarms
- Regularly review and optimize resource allocation
- Use AWS Budgets to track and control spending

### Scalability Considerations
- Current estimate based on 20 concurrent users
- Infrastructure can easily scale to 50-100 users
- Performance testing recommended before scaling
- Estimated cost increase: Linear with user count

**Note:** Prices are approximate and subject to change. Always verify current AWS pricing and consult with AWS support for the most accurate estimates.

## Potential Challenges
- Environment variable management
- Performance tuning
- Initial configuration complexity

## Recommended Next Steps
1. Conduct thorough infrastructure assessment
2. Create detailed migration plan
3. Set up staging environment
4. Perform incremental migration
5. Implement comprehensive testing strategy

## Rollback Strategy
- Maintain current Docker Compose setup
- Use blue/green deployment
- Keep existing infrastructure running in parallel

---

**Note:** This is a living document. Adjust strategy based on specific requirements and ongoing discoveries during migration.
