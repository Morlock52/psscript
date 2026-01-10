#!/bin/bash
set -e

# Configuration
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -lh /backups/redis/*.rdb.gz
    exit 1
fi

# Redis connection details
REDIS_HOST=${REDIS_HOST:-redis-master}
REDIS_PORT=${REDIS_PORT:-6379}

echo "[$(date)] Starting Redis restore from: $BACKUP_FILE"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Extract backup if compressed
TEMP_RDB="/tmp/restore_dump.rdb"
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" > "$TEMP_RDB"
else
    cp "$BACKUP_FILE" "$TEMP_RDB"
fi

# Stop Redis writes
echo "[$(date)] Enabling Redis read-only mode..."
redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} CONFIG SET appendonly no

# Copy RDB file to Redis container
echo "[$(date)] Copying RDB file to Redis container..."
docker cp "$TEMP_RDB" psscript-redis-master-1:/data/dump.rdb

# Restart Redis to load the backup
echo "[$(date)] Restarting Redis to load backup..."
docker restart psscript-redis-master-1

# Wait for Redis to be ready
echo "[$(date)] Waiting for Redis to be ready..."
sleep 5
until redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} ping 2>/dev/null; do
    echo "[$(date)] Waiting for Redis..."
    sleep 2
done

# Re-enable AOF
echo "[$(date)] Re-enabling Redis persistence..."
redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} CONFIG SET appendonly yes

# Cleanup
rm -f "$TEMP_RDB"

echo "[$(date)] Redis restore completed successfully"
