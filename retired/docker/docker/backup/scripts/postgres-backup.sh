#!/bin/bash
set -e

# Configuration
BACKUP_TYPE=${1:-full}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
BACKUP_FILE="psscript_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# PostgreSQL connection details
PGHOST=${POSTGRES_HOST:-postgres}
PGPORT=${POSTGRES_PORT:-5432}
PGDATABASE=${POSTGRES_DB:-psscript}
PGUSER=${POSTGRES_USER:-postgres}
PGPASSWORD=${POSTGRES_PASSWORD:-postgres}

export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

echo "[$(date)] Starting PostgreSQL ${BACKUP_TYPE} backup..."

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Perform backup based on type
if [ "$BACKUP_TYPE" = "full" ]; then
    echo "[$(date)] Performing full database backup..."
    pg_dump -Fc -v -f "${BACKUP_PATH%.gz}" 2>&1 | tee -a /backups/logs/backup.log
    gzip -f "${BACKUP_PATH%.gz}"
else
    echo "[$(date)] Performing incremental backup (WAL archive)..."
    # For incremental backups, we archive WAL files
    ARCHIVE_DIR="${BACKUP_DIR}/wal_${TIMESTAMP}"
    mkdir -p ${ARCHIVE_DIR}

    # Use pg_basebackup for incremental backup
    pg_basebackup -h ${PGHOST} -p ${PGPORT} -U ${PGUSER} -D ${ARCHIVE_DIR} -Ft -z -P 2>&1 | tee -a /backups/logs/backup.log
fi

# Verify backup
if [ -f "${BACKUP_PATH}" ] || [ -d "${ARCHIVE_DIR}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_PATH}" 2>/dev/null | cut -f1 || echo "N/A")
    echo "[$(date)] Backup completed successfully. Size: ${BACKUP_SIZE}"

    # Upload to S3 if configured
    if [ -n "${S3_BUCKET}" ] && [ -n "${AWS_ACCESS_KEY_ID}" ]; then
        echo "[$(date)] Uploading backup to S3..."
        aws s3 cp "${BACKUP_PATH}" "s3://${S3_BUCKET}/postgres/${BACKUP_FILE}" \
            --region ${S3_REGION:-us-east-1} \
            --storage-class STANDARD_IA 2>&1 | tee -a /backups/logs/backup.log
        echo "[$(date)] S3 upload completed"
    fi

    # Create backup metadata
    cat > "${BACKUP_PATH}.meta" <<EOF
{
    "timestamp": "${TIMESTAMP}",
    "type": "${BACKUP_TYPE}",
    "database": "${PGDATABASE}",
    "size": "${BACKUP_SIZE}",
    "file": "${BACKUP_FILE}",
    "status": "completed"
}
EOF

else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

echo "[$(date)] PostgreSQL backup process completed"
