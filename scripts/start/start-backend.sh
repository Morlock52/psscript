#!/bin/bash

export NODE_ENV=development
export PORT=4001
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=psscript
export DB_USER=postgres
export DB_PASSWORD=postgres
export AI_SERVICE_URL=${AI_SERVICE_URL:-http://localhost:8000}

echo "Checking if PostgreSQL is running..."

if command -v psql &> /dev/null; then
  psql -h localhost -p 5432 -U postgres -c "SELECT 1" &> /dev/null
  PG_STATUS=$?
elif command -v pg_isready &> /dev/null; then
  pg_isready -h localhost -p 5432 -d postgres -U postgres &> /dev/null
  PG_STATUS=$?
else
  nc -z localhost 5432 &> /dev/null
  PG_STATUS=$?
fi

if [ $PG_STATUS -ne 0 ]; then
  echo "Warning: PostgreSQL is not running or not accessible. Start it before relying on backend DB features."
fi

cd src/backend

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Checking database connection..."
node test-db.js

echo "Starting backend service on port $PORT..."
npm run dev
