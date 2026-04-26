#!/bin/bash
set -e

# Configuration
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
POSTGRES_BACKUP_DIR="/backups/postgres"
REDIS_BACKUP_DIR="/backups/redis"

echo "[$(date)] Starting backup cleanup process..."
echo "[$(date)] Retention policy: ${RETENTION_DAYS} days"

# Function to clean old backups
cleanup_old_files() {
    local dir=$1
    local pattern=$2
    local count=0

    echo "[$(date)] Cleaning up ${dir}..."

    # Find and delete files older than retention period
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            echo "[$(date)] Deleting old backup: $(basename $file)"
            rm -f "$file"
            rm -f "${file}.meta"
            ((count++))
        fi
    done < <(find "$dir" -name "$pattern" -type f -mtime +${RETENTION_DAYS})

    echo "[$(date)] Deleted $count old backup(s) from ${dir}"
}

# Clean PostgreSQL backups
if [ -d "$POSTGRES_BACKUP_DIR" ]; then
    cleanup_old_files "$POSTGRES_BACKUP_DIR" "psscript_*.sql.gz"
    cleanup_old_files "$POSTGRES_BACKUP_DIR" "wal_*"
fi

# Clean Redis backups
if [ -d "$REDIS_BACKUP_DIR" ]; then
    cleanup_old_files "$REDIS_BACKUP_DIR" "redis_*.rdb.gz"
fi

# Clean old logs (keep last 90 days)
LOG_DIR="/backups/logs"
if [ -d "$LOG_DIR" ]; then
    echo "[$(date)] Cleaning up old logs..."
    find "$LOG_DIR" -name "*.log" -type f -mtime +90 -delete
fi

# Generate backup report
echo "[$(date)] Generating backup inventory..."
REPORT_FILE="/backups/backup_inventory_$(date +%Y%m%d).txt"

cat > "$REPORT_FILE" <<EOF
Backup Inventory Report
Generated: $(date)
Retention Policy: ${RETENTION_DAYS} days
=====================================

PostgreSQL Backups:
EOF

if [ -d "$POSTGRES_BACKUP_DIR" ]; then
    ls -lh "$POSTGRES_BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -20 >> "$REPORT_FILE" || echo "No backups found" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" <<EOF

Redis Backups:
EOF

if [ -d "$REDIS_BACKUP_DIR" ]; then
    ls -lh "$REDIS_BACKUP_DIR"/*.rdb.gz 2>/dev/null | tail -20 >> "$REPORT_FILE" || echo "No backups found" >> "$REPORT_FILE"
fi

# Calculate total backup size
TOTAL_SIZE=$(du -sh /backups 2>/dev/null | cut -f1)
echo "" >> "$REPORT_FILE"
echo "Total Backup Size: ${TOTAL_SIZE}" >> "$REPORT_FILE"

# Upload report to S3 if configured
if [ -n "${S3_BUCKET}" ] && [ -n "${AWS_ACCESS_KEY_ID}" ]; then
    aws s3 cp "$REPORT_FILE" "s3://${S3_BUCKET}/reports/$(basename $REPORT_FILE)" \
        --region ${S3_REGION:-us-east-1} 2>&1 | tee -a /backups/logs/backup.log
fi

echo "[$(date)] Cleanup process completed"
echo "[$(date)] Total backup storage: ${TOTAL_SIZE}"
