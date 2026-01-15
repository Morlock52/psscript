#!/bin/bash
# Run ldconfig to ensure pgvector library is properly linked
# This script runs before PostgreSQL starts

echo "Running ldconfig for pgvector..."
ldconfig

# Ensure vector extension is installed if not already
if [ -f /usr/lib/postgresql/15/lib/vector.so ]; then
    echo "pgvector library found at /usr/lib/postgresql/15/lib/vector.so"
else
    echo "Installing pgvector..."
    apt-get update && apt-get install -y postgresql-15-pgvector
    ldconfig
fi

echo "pgvector initialization complete"
