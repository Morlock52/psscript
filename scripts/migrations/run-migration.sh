#!/bin/bash

# Script to run the migration to add updated_at column to categories table

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL must point at hosted Supabase Postgres."
  exit 1
fi

case "$DATABASE_URL" in
  *".supabase.co"*|*".supabase.com"*) ;;
  *)
    echo "Refusing to run against a local or non-Supabase database."
    exit 1
    ;;
esac

# Run the migration
echo "Running migration to add updated_at column to categories table..."
psql "$DATABASE_URL" -f src/db/migrations/add_updated_at_to_categories.sql

if [ $? -eq 0 ]; then
  echo "Migration completed successfully."
else
  echo "Migration failed. Please check the error message above."
  exit 1
fi

echo "Migration completed. The categories table now has an updated_at column."
