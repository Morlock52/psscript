#!/bin/bash
set -e

# Configuration
HEALTH_LOG="/backups/logs/health.log"
ALERT_FILE="/backups/alerts.txt"

echo "[$(date)] Running health checks..."

# Function to check service health
check_service() {
    local service=$1
    local host=$2
    local port=$3

    if nc -z -w5 "$host" "$port" 2>/dev/null; then
        echo "[$(date)] ✓ $service is healthy ($host:$port)"
        return 0
    else
        echo "[$(date)] ✗ $service is DOWN ($host:$port)" | tee -a "$ALERT_FILE"
        return 1
    fi
}

# Check PostgreSQL
check_service "PostgreSQL" "${POSTGRES_HOST:-postgres}" "${POSTGRES_PORT:-5432}"

# Check Redis Master
check_service "Redis Master" "${REDIS_HOST:-redis-master}" "${REDIS_PORT:-6379}"

# Check disk space
DISK_USAGE=$(df /backups | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "[$(date)] WARNING: Disk usage is at ${DISK_USAGE}%" | tee -a "$ALERT_FILE"
elif [ "$DISK_USAGE" -gt 80 ]; then
    echo "[$(date)] NOTICE: Disk usage is at ${DISK_USAGE}%"
else
    echo "[$(date)] ✓ Disk usage is healthy (${DISK_USAGE}%)"
fi

# Check last backup age
LAST_POSTGRES_BACKUP=$(find /backups/postgres -name "psscript_*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2)
if [ -n "$LAST_POSTGRES_BACKUP" ]; then
    BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LAST_POSTGRES_BACKUP")) / 3600 ))
    if [ "$BACKUP_AGE" -gt 48 ]; then
        echo "[$(date)] WARNING: Last PostgreSQL backup is ${BACKUP_AGE} hours old" | tee -a "$ALERT_FILE"
    else
        echo "[$(date)] ✓ Last PostgreSQL backup is ${BACKUP_AGE} hours old"
    fi
else
    echo "[$(date)] WARNING: No PostgreSQL backups found" | tee -a "$ALERT_FILE"
fi

# Check Redis Sentinel
SENTINEL_STATUS=$(redis-cli -h redis-sentinel-1 -p 26379 SENTINEL master mymaster 2>/dev/null | grep -E "^(flags|num-slaves)" || echo "unavailable")
if [ "$SENTINEL_STATUS" != "unavailable" ]; then
    echo "[$(date)] ✓ Redis Sentinel is monitoring"
else
    echo "[$(date)] WARNING: Redis Sentinel check failed" | tee -a "$ALERT_FILE"
fi

echo "[$(date)] Health check completed"
