#!/bin/bash

# Script to run the categories migration

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

# Display connection info
echo "Running categories migration against hosted Supabase DATABASE_URL"

# Run the migration
echo "Running migration..."
psql "$DATABASE_URL" -f src/db/migrations/update_categories.sql

# Check if the migration was successful
if [ $? -eq 0 ]; then
  echo "Migration completed successfully!"
  
  # Count the number of categories
  echo "Verifying categories..."
  psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM categories;"
  
  # List the categories
  echo "Categories in the database:"
  psql "$DATABASE_URL" -c "SELECT id, name FROM categories ORDER BY id;"
else
  echo "Migration failed!"
fi
