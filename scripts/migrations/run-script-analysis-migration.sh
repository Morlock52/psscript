#!/bin/bash

# Script to run the migration to add command_details and ms_docs_references columns to script_analysis table

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
echo "Running migration to add command_details and ms_docs_references columns to script_analysis table..."
psql "$DATABASE_URL" -f src/db/migrations/add_command_details_to_script_analysis.sql

if [ $? -eq 0 ]; then
  echo "Migration completed successfully."
else
  echo "Migration failed. Please check the error message above."
  exit 1
fi

echo "Migration completed. The script_analysis table now has command_details and ms_docs_references columns."
