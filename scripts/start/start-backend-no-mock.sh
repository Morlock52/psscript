#!/bin/bash

export NODE_ENV=development
export PORT=4001
export DB_PROFILE=supabase
export AI_SERVICE_URL=${AI_SERVICE_URL:-http://localhost:8000}

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL must point at hosted Supabase Postgres."
  exit 1
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
