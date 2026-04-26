# Backup Service Documentation

## Overview

The backup service provides automated backup, retention management, and disaster recovery capabilities for PostgreSQL and Redis.

## Features

- Automated scheduled backups (full and incremental)
- Configurable retention policies
- Optional S3 cloud storage integration
- Health monitoring and alerting
- Backup verification and metadata tracking
- Easy restore operations

## Backup Scripts

### postgres-backup.sh

Performs PostgreSQL database backups.

**Usage:**
```bash
# Full backup
docker-compose exec backup-service /scripts/postgres-backup.sh full

# Incremental backup (WAL archive)
docker-compose exec backup-service /scripts/postgres-backup.sh incremental
```

**Features:**
- Creates compressed SQL dumps for full backups
- Uses pg_basebackup for incremental backups
- Generates backup metadata
- Automatically uploads to S3 if configured
- Logs all operations

### redis-backup.sh

Creates Redis snapshot backups.

**Usage:**
```bash
docker-compose exec backup-service /scripts/redis-backup.sh
```

**Features:**
- Triggers BGSAVE on Redis master
- Waits for save completion
- Compresses RDB file
- Uploads to S3 if configured
- Creates backup metadata

### cleanup-backups.sh

Removes old backups based on retention policy.

**Usage:**
```bash
docker-compose exec backup-service /scripts/cleanup-backups.sh
```

**Features:**
- Deletes backups older than retention period
- Generates backup inventory report
- Cleans old log files
- Calculates total backup storage
- Uploads inventory to S3

**Configuration:**
- `BACKUP_RETENTION_DAYS` - Number of days to retain backups (default: 30)

### health-check.sh

Monitors service health and backup status.

**Usage:**
```bash
docker-compose exec backup-service /scripts/health-check.sh
```

**Checks:**
- PostgreSQL connectivity
- Redis Master connectivity
- Disk space utilization
- Backup freshness
- Redis Sentinel status

**Alerts:**
- Creates alerts file when issues detected
- Logs warnings for attention
- Can be integrated with monitoring systems

### restore-postgres.sh

Restores PostgreSQL from a backup file.

**Usage:**
```bash
# List available backups
docker-compose exec backup-service /scripts/restore-postgres.sh

# Restore from specific backup
docker-compose exec backup-service /scripts/restore-postgres.sh /backups/postgres/psscript_full_20260107_020000.sql.gz
```

**Safety Features:**
- Creates safety backup before restore
- Terminates existing connections
- Recreates database cleanly
- Verifies backup file exists

### restore-redis.sh

Restores Redis from a snapshot backup.

**Usage:**
```bash
# List available backups
docker-compose exec backup-service /scripts/restore-redis.sh

# Restore from specific backup
docker-compose exec backup-service /scripts/restore-redis.sh /backups/redis/redis_20260107_020000.rdb.gz
```

**Process:**
- Enables Redis read-only mode
- Copies RDB file to Redis container
- Restarts Redis to load backup
- Re-enables persistence

## Backup Schedules

Default cron schedules (configurable via environment variables):

| Backup Type | Schedule | Environment Variable |
|-------------|----------|---------------------|
| PostgreSQL Full | Daily at 2 AM | `BACKUP_SCHEDULE_FULL` |
| PostgreSQL Incremental | Every 6 hours | `BACKUP_SCHEDULE_INCREMENTAL` |
| Redis Snapshot | Every 4 hours | `BACKUP_SCHEDULE_REDIS` |
| Cleanup Old Backups | Daily at 3 AM | `BACKUP_SCHEDULE_CLEANUP` |
| Health Check | Every 5 minutes | N/A (hardcoded) |

**Cron Format:** `minute hour day month weekday`

Examples:
- `0 2 * * *` - Daily at 2 AM
- `0 */6 * * *` - Every 6 hours
- `*/30 * * * *` - Every 30 minutes
- `0 0 * * 0` - Weekly on Sunday at midnight

## S3 Integration

To enable automatic upload to AWS S3, configure these environment variables:

```bash
BACKUP_S3_BUCKET=your-bucket-name
BACKUP_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

**S3 Bucket Structure:**
```
your-bucket/
├── postgres/
│   ├── psscript_full_20260107_020000.sql.gz
│   └── psscript_incremental_20260107_080000.tar.gz
├── redis/
│   └── redis_20260107_040000.rdb.gz
└── reports/
    └── backup_inventory_20260107.txt
```

**Storage Class:**
- STANDARD_IA (Infrequent Access) for cost optimization
- Can be modified in backup scripts

## Backup Storage

**Local Storage:**
- PostgreSQL: `/backups/postgres/`
- Redis: `/backups/redis/`
- Logs: `/backups/logs/`

**Backup Naming:**
- PostgreSQL Full: `psscript_full_YYYYMMDD_HHMMSS.sql.gz`
- PostgreSQL Incremental: `wal_YYYYMMDD_HHMMSS/`
- Redis: `redis_YYYYMMDD_HHMMSS.rdb.gz`

**Metadata Files:**
Each backup includes a `.meta` file with JSON metadata:
```json
{
    "timestamp": "20260107_020000",
    "type": "full",
    "database": "psscript",
    "size": "150M",
    "file": "psscript_full_20260107_020000.sql.gz",
    "status": "completed"
}
```

## Monitoring Backup Health

**View Backup Logs:**
```bash
# Real-time backup logs
tail -f backups/logs/backup.log

# Health check logs
tail -f backups/logs/health.log

# Docker logs
docker-compose logs -f backup-service
```

**Check Backup Inventory:**
```bash
# List PostgreSQL backups
ls -lh backups/postgres/

# List Redis backups
ls -lh backups/redis/

# View latest inventory report
cat backups/backup_inventory_$(date +%Y%m%d).txt
```

**Manual Health Check:**
```bash
docker-compose exec backup-service /scripts/health-check.sh
```

## Disaster Recovery Procedures

### Full System Recovery

1. **Ensure backup service is running:**
```bash
docker-compose up -d postgres pgbouncer redis-master backup-service
```

2. **Identify latest backups:**
```bash
docker-compose exec backup-service ls -lh /backups/postgres/
docker-compose exec backup-service ls -lh /backups/redis/
```

3. **Restore PostgreSQL:**
```bash
docker-compose exec backup-service /scripts/restore-postgres.sh /backups/postgres/psscript_full_LATEST.sql.gz
```

4. **Restore Redis:**
```bash
docker-compose exec backup-service /scripts/restore-redis.sh /backups/redis/redis_LATEST.rdb.gz
```

5. **Verify restoration:**
```bash
docker-compose exec postgres psql -U postgres -d psscript -c "SELECT COUNT(*) FROM scripts;"
docker-compose exec redis-master redis-cli DBSIZE
```

6. **Start all services:**
```bash
docker-compose up -d
```

### Point-in-Time Recovery (PostgreSQL)

For point-in-time recovery using incremental backups:

1. **Restore latest full backup:**
```bash
docker-compose exec backup-service /scripts/restore-postgres.sh /backups/postgres/psscript_full_YYYYMMDD_HHMMSS.sql.gz
```

2. **Apply WAL files from incremental backups:**
```bash
# Extract WAL archive
docker-compose exec backup-service tar -xzf /backups/postgres/wal_YYYYMMDD_HHMMSS/base.tar.gz -C /tmp/restore/

# Configure recovery
docker-compose exec postgres sh -c "echo 'restore_command = \"cp /backups/postgres/wal/%f %p\"' >> /var/lib/postgresql/data/recovery.conf"

# Restart PostgreSQL
docker-compose restart postgres
```

## Troubleshooting

### Backup Failures

**Check disk space:**
```bash
docker-compose exec backup-service df -h /backups
```

**Verify database connectivity:**
```bash
docker-compose exec backup-service pg_isready -h postgres -U postgres
docker-compose exec backup-service redis-cli -h redis-master ping
```

**Review backup logs:**
```bash
tail -100 backups/logs/backup.log
```

**Test manual backup:**
```bash
docker-compose exec backup-service /scripts/postgres-backup.sh full
docker-compose exec backup-service /scripts/redis-backup.sh
```

### S3 Upload Failures

**Verify AWS credentials:**
```bash
docker-compose exec backup-service aws s3 ls s3://$BACKUP_S3_BUCKET/
```

**Check IAM permissions:**
Required S3 permissions:
- `s3:PutObject`
- `s3:GetObject`
- `s3:ListBucket`

**Test manual upload:**
```bash
docker-compose exec backup-service aws s3 cp /backups/postgres/test.txt s3://$BACKUP_S3_BUCKET/test.txt
```

### Restore Issues

**Verify backup file integrity:**
```bash
# Test gunzip
docker-compose exec backup-service gunzip -t /backups/postgres/psscript_full_YYYYMMDD_HHMMSS.sql.gz

# Check file size
docker-compose exec backup-service ls -lh /backups/postgres/
```

**Check PostgreSQL logs:**
```bash
docker-compose logs postgres
```

**Verify permissions:**
```bash
docker-compose exec backup-service ls -la /backups/postgres/
```

## Best Practices

1. **Regular Testing:**
   - Test restore procedures monthly
   - Verify backup integrity weekly
   - Monitor backup logs daily

2. **Retention Strategy:**
   - Keep 7 daily backups
   - Keep 4 weekly backups
   - Keep 12 monthly backups
   - Archive yearly backups to glacier storage

3. **Monitoring:**
   - Set up alerts for backup failures
   - Monitor disk space utilization
   - Track backup sizes and durations

4. **Security:**
   - Encrypt backups at rest
   - Use encrypted S3 buckets
   - Rotate AWS credentials regularly
   - Restrict access to backup files

5. **Documentation:**
   - Document recovery procedures
   - Maintain backup inventory
   - Track restoration times
   - Document any custom configurations

## Performance Optimization

**PostgreSQL Backups:**
- Use compression for large databases
- Schedule during low-traffic periods
- Consider parallel backup for very large databases
- Use incremental backups between full backups

**Redis Backups:**
- Use BGSAVE instead of SAVE to avoid blocking
- Schedule during low-memory usage periods
- Monitor RDB file size growth
- Consider AOF for more frequent backups

**S3 Transfers:**
- Use multipart upload for large files
- Enable S3 transfer acceleration for remote regions
- Use appropriate storage classes
- Implement lifecycle policies for old backups

## Support

For issues or questions:
1. Check backup logs in `/backups/logs/`
2. Review Docker logs: `docker-compose logs backup-service`
3. Verify configuration in `.env` file
4. Consult main documentation in `docs/DOCKER-INFRASTRUCTURE.md`
