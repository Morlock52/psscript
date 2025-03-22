#!/bin/bash

# Script to run the deep crawl migration

# Load environment variables
source .env 2>/dev/null || echo "No .env file found, using existing environment variables"

# Check if database connection details are available
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  echo "Error: Database connection details not found in environment variables"
  echo "Please set DB_HOST, DB_PORT, DB_NAME, and DB_USER"
  exit 1
fi

# Set password argument if DB_PASSWORD is set
DB_PASSWORD_ARG=""
if [ ! -z "$DB_PASSWORD" ]; then
  DB_PASSWORD_ARG="-p$DB_PASSWORD"
fi

echo "Running deep crawl migration..."
echo "Migration: add_deep_crawl_fields.sql"

# Run the migration
psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -f src/db/migrations/add_deep_crawl_fields.sql

# Check if the migration was successful
if [ $? -eq 0 ]; then
  echo "Migration completed successfully"
else
  echo "Error: Migration failed"
  exit 1
fi

echo "Deep crawl migration completed"
