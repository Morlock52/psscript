#!/bin/bash

# Script to check and install pgvector extension

echo "Checking PostgreSQL pgvector extension..."
node check-pgvector.js

# Check if the script exited with an error
if [ $? -ne 0 ]; then
  echo "Error: Failed to check or install pgvector extension."
  exit 1
fi

echo "pgvector check completed successfully."
