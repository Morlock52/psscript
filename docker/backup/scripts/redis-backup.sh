#!/bin/bash
set -e

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/redis"
BACKUP_FILE="redis_${TIMESTAMP}.rdb"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Redis connection details
REDIS_HOST=${REDIS_HOST:-redis-master}
REDIS_PORT=${REDIS_PORT:-6379}

echo "[$(date)] Starting Redis backup..."

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Trigger BGSAVE on Redis master
echo "[$(date)] Triggering Redis BGSAVE..."
redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} BGSAVE

# Wait for BGSAVE to complete
while true; do
    SAVE_STATUS=$(redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} LASTSAVE)
    sleep 2
    NEW_SAVE_STATUS=$(redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} LASTSAVE)
    if [ "$SAVE_STATUS" != "$NEW_SAVE_STATUS" ]; then
        echo "[$(date)] BGSAVE completed"
        break
    fi
    echo "[$(date)] Waiting for BGSAVE to complete..."
    sleep 3
done

# Copy RDB file from Redis container
echo "[$(date)] Copying Redis dump file..."
docker cp psscript-redis-master-1:/data/dump.rdb "${BACKUP_PATH}" 2>&1 | tee -a /backups/logs/backup.log || \
    cp /redis_data/dump.rdb "${BACKUP_PATH}" 2>&1 | tee -a /backups/logs/backup.log

# Compress backup
echo "[$(date)] Compressing backup..."
gzip -f "${BACKUP_PATH}"
BACKUP_PATH="${BACKUP_PATH}.gz"

# Verify backup
if [ -f "${BACKUP_PATH}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
    echo "[$(date)] Backup completed successfully. Size: ${BACKUP_SIZE}"

    # Upload to S3 if configured
    if [ -n "${S3_BUCKET}" ] && [ -n "${AWS_ACCESS_KEY_ID}" ]; then
        echo "[$(date)] Uploading backup to S3..."
        aws s3 cp "${BACKUP_PATH}" "s3://${S3_BUCKET}/redis/${BACKUP_FILE}.gz" \
            --region ${S3_REGION:-us-east-1} \
            --storage-class STANDARD_IA 2>&1 | tee -a /backups/logs/backup.log
        echo "[$(date)] S3 upload completed"
    fi

    # Create backup metadata
    cat > "${BACKUP_PATH}.meta" <<EOF
{
    "timestamp": "${TIMESTAMP}",
    "type": "snapshot",
    "host": "${REDIS_HOST}",
    "size": "${BACKUP_SIZE}",
    "file": "${BACKUP_FILE}.gz",
    "status": "completed"
}
EOF

else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

echo "[$(date)] Redis backup process completed"
