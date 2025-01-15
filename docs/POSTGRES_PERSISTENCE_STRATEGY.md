# PostgreSQL Persistence Strategy for AWS Fargate

## Challenges with Containerized Databases in Serverless Environments

### Current Docker Compose Setup
```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - ../database/init.sql:/docker-entrypoint-initdb.d/init.sql
```

### Implemented Solution

### EFS Configuration
- **EFS Filesystem**: Created and mounted for PostgreSQL data persistence
- **Mount Points**: Configured in all availability zones where our ECS tasks run
- **Access Points**: Created with proper security groups and VPC settings

### Container Configuration
The PostgreSQL service has been successfully configured with the following settings:

```yaml
environment:
  - POSTGRES_USER=postgres
  - POSTGRES_PASSWORD=postgres
  - POSTGRES_DB=trivia_db
  - TZ=America/Phoenix

mountPoints:
  - sourceVolume: postgres-data
    containerPath: /var/lib/postgresql/data
    readOnly: false
```

### Security Groups
- **PostgreSQL Security Group**: `sg-08ad372f66d0bed7a`
  - Inbound Rules:
    - Port 5432 (PostgreSQL) from ECS services
  - Outbound Rules:
    - All traffic to VPC CIDR

### Monitoring
CloudWatch alarms have been set up for:
- CPU Utilization (>80%)
- Memory Utilization (>80%)
- Available Storage Space
- Connection Count

### Backup Strategy
- **Primary Storage**: AWS EFS
  - Mounted at `/var/lib/postgresql/data`
  - Persistent across container restarts
  - Automatic replication across AZs

- **Backup Implementation**: To be completed
  - Regular snapshots to S3
  - Point-in-time recovery capability
  - Automated backup rotation

## Current Status
EFS filesystem created and mounted
PostgreSQL service running with persistence
Basic monitoring implemented
Automated backups not yet implemented

## Next Steps
1. Implement automated backup strategy to S3
2. Set up backup rotation policy
3. Create disaster recovery documentation
4. Implement point-in-time recovery capability

## Lessons Learned
1. EFS mount targets must be created in all AZs where ECS tasks run
2. Security group configuration is critical for proper connectivity
3. Container restart policy ensures database availability
4. Environment variables must be consistent across all services

### Persistence Options in AWS Fargate

#### Option 1: AWS Elastic File System (EFS)
- Fully managed, scalable file storage
- Direct integration with Fargate
- Persistent storage across container restarts

**Implementation Steps:**
1. Create EFS Filesystem
```bash
aws efs create-file-system \
  --creation-token trivia60-postgres-volume \
  --performance-mode generalPurpose \
  --throughput-mode bursting
```

2. Modify ECS Task Definition
```json
{
  "volumes": [
    {
      "name": "postgres-data",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-12345678",
        "rootDirectory": "/postgres-data",
        "transitEncryption": "ENABLED"
      }
    }
  ],
  "containerDefinitions": [
    {
      "mountPoints": [
        {
          "sourceVolume": "postgres-data",
          "containerPath": "/var/lib/postgresql/data",
          "readOnly": false
        }
      ]
    }
  ]
}
```

#### Option 2: Backup and Restore Strategy
1. Regular Database Backups
```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR="/mnt/backups/postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
pg_dump -U postgres trivia_db > "${BACKUP_DIR}/trivia_db_${TIMESTAMP}.sql"

# Rotate backups (keep last 7 days)
find "${BACKUP_DIR}" -name "*.sql" -mtime +7 -delete
```

2. Periodic Snapshot to S3
```bash
aws s3 cp /mnt/backups/postgres/latest_backup.sql s3://trivia60-backups/postgres/
```

### Recommended Approach: Hybrid Strategy

1. Use EFS for primary data persistence
2. Implement periodic S3 backups
3. Create init script for database recovery

#### Recovery Script
```bash
#!/bin/bash
# Check if database is empty
if [ ! "$(ls -A /var/lib/postgresql/data)" ]; then
    echo "Initializing database..."
    
    # Restore from latest S3 backup if exists
    LATEST_BACKUP=$(aws s3 ls s3://trivia60-backups/postgres/ | sort | tail -n 1)
    if [ -n "$LATEST_BACKUP" ]; then
        aws s3 cp "s3://trivia60-backups/postgres/$LATEST_BACKUP" /tmp/restore.sql
        psql -U postgres -d trivia_db -f /tmp/restore.sql
    else
        # Fallback to initial schema
        psql -U postgres -d trivia_db -f /docker-entrypoint-initdb.d/init.sql
    fi
fi
```

### Monitoring and Reliability

1. CloudWatch Metrics
- Track database size
- Monitor backup frequency
- Alert on backup failures

2. Health Checks
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 30s
  timeout: 10s
  retries: 5
```

### Cost Considerations
- EFS: ~$0.30 per GB-month
- S3 Backups: ~$0.023 per GB-month
- Estimated Monthly Cost: $5-$20 depending on data size

### Potential Risks and Mitigations
1. Data Corruption
   - Implement regular integrity checks
   - Maintain multiple backup generations

2. Performance Overhead
   - Use EFS Provisioned Throughput mode
   - Monitor and adjust as needed

## Implementation Checklist
- [ ] Create EFS Filesystem
- [ ] Configure backup scripts
- [ ] Set up S3 backup bucket
- [ ] Modify ECS task definition
- [ ] Implement recovery script
- [ ] Set up CloudWatch monitoring

**Note:** This strategy preserves your existing Docker Compose database approach while adding cloud-native persistence and backup mechanisms.
