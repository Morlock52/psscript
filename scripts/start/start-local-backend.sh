#!/bin/bash

export NODE_ENV=development
export DB_PROFILE=supabase
export AI_SERVICE_URL=${AI_SERVICE_URL:-http://localhost:8000}

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL must point at hosted Supabase Postgres."
  exit 1
fi

mkdir -p ./src/backend/uploads
mkdir -p ./src/backend/src/public/uploads

cd ./src/backend

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting backend server without mock services..."
npm start
