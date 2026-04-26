#!/bin/bash
set -e

echo "Starting backup service..."

# Configure cron jobs
echo "Configuring backup schedules..."

# Full backup schedule (default: 2 AM daily)
FULL_SCHEDULE="${BACKUP_SCHEDULE_FULL:-0 2 * * *}"
echo "$FULL_SCHEDULE /scripts/postgres-backup.sh full >> /backups/logs/backup.log 2>&1" > /etc/crontabs/root

# Incremental backup schedule (default: every 6 hours)
INCREMENTAL_SCHEDULE="${BACKUP_SCHEDULE_INCREMENTAL:-0 */6 * * *}"
echo "$INCREMENTAL_SCHEDULE /scripts/postgres-backup.sh incremental >> /backups/logs/backup.log 2>&1" >> /etc/crontabs/root

# Redis backup schedule (default: every 4 hours)
REDIS_SCHEDULE="${BACKUP_SCHEDULE_REDIS:-0 */4 * * *}"
echo "$REDIS_SCHEDULE /scripts/redis-backup.sh >> /backups/logs/backup.log 2>&1" >> /etc/crontabs/root

# Cleanup old backups (default: daily at 3 AM)
CLEANUP_SCHEDULE="${BACKUP_SCHEDULE_CLEANUP:-0 3 * * *}"
echo "$CLEANUP_SCHEDULE /scripts/cleanup-backups.sh >> /backups/logs/backup.log 2>&1" >> /etc/crontabs/root

# Health check (default: every 5 minutes)
echo "*/5 * * * * /scripts/health-check.sh >> /backups/logs/health.log 2>&1" >> /etc/crontabs/root

echo "Cron schedules configured:"
cat /etc/crontabs/root

# Run initial backup on startup
echo "Running initial backup..."
/scripts/postgres-backup.sh full
/scripts/redis-backup.sh

# Start cron daemon
exec "$@"
