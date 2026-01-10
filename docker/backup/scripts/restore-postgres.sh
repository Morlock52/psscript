#!/bin/bash
set -e

# Configuration
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -lh /backups/postgres/*.sql.gz
    exit 1
fi

# PostgreSQL connection details
PGHOST=${POSTGRES_HOST:-postgres}
PGPORT=${POSTGRES_PORT:-5432}
PGDATABASE=${POSTGRES_DB:-psscript}
PGUSER=${POSTGRES_USER:-postgres}
PGPASSWORD=${POSTGRES_PASSWORD:-postgres}

export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

echo "[$(date)] Starting PostgreSQL restore from: $BACKUP_FILE"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Create a backup of current database before restore
echo "[$(date)] Creating safety backup of current database..."
SAFETY_BACKUP="/backups/postgres/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump -Fc -v -f "${SAFETY_BACKUP%.gz}"
gzip -f "${SAFETY_BACKUP%.gz}"
echo "[$(date)] Safety backup created: $SAFETY_BACKUP"

# Terminate existing connections
echo "[$(date)] Terminating existing connections..."
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PGDATABASE}' AND pid <> pg_backend_pid();"

# Drop and recreate database
echo "[$(date)] Recreating database..."
psql -d postgres -c "DROP DATABASE IF EXISTS ${PGDATABASE};"
psql -d postgres -c "CREATE DATABASE ${PGDATABASE};"

# Restore from backup
echo "[$(date)] Restoring database..."
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | pg_restore -d ${PGDATABASE} -v
else
    pg_restore -d ${PGDATABASE} -v "$BACKUP_FILE"
fi

echo "[$(date)] Database restore completed successfully"
echo "[$(date)] Safety backup available at: $SAFETY_BACKUP"
