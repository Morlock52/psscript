#!/bin/bash

# Start the backend service for local development

# Set environment variables
export NODE_ENV=development
export PORT=4001  # Changed from 4000 to avoid port conflict
export USE_MOCK_SERVICES=true
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=psscript
export DB_USER=postgres
export DB_PASSWORD=postgres
export AI_SERVICE_URL=http://localhost:8000

# Check if PostgreSQL is running
echo "Checking if PostgreSQL is running..."

# Try to connect to PostgreSQL using a more universal approach
if command -v psql &> /dev/null; then
  # If psql is available, use it
  psql -h localhost -p 5432 -U postgres -c "SELECT 1" &> /dev/null
  PG_STATUS=$?
elif command -v pg_isready &> /dev/null; then
  # If pg_isready is available, use it
  pg_isready -h localhost -p 5432 -d postgres -U postgres &> /dev/null
  PG_STATUS=$?
else
  # If neither is available, try a direct socket connection
  nc -z localhost 5432 &> /dev/null
  PG_STATUS=$?
fi

if [ $PG_STATUS -ne 0 ]; then
  echo "Error: PostgreSQL is not running or not accessible. Please start PostgreSQL first."
  echo "You can use 'brew services start postgresql' or 'pg_ctl start'."
  echo "For this test, we'll continue anyway and use mock services."
  export USE_MOCK_SERVICES=true
  # Continue instead of exiting
  # exit 1
fi

# Navigate to backend directory
cd src/backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Run setup script if needed
echo "Checking database connection..."
node test-db.js

# Start the backend service
echo "Starting backend service on port $PORT..."
npm run dev

# Handle exit
exit_handler() {
  echo "Shutting down backend service..."
  exit 0
}

trap 'exit_handler' SIGINT SIGTERM

# Wait for the backend service to exit
wait
