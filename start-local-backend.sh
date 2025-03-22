#!/bin/bash

# Set environment variables
export USE_MOCK_SERVICES=true
export MOCK_MODE=true
export MOCK_AI_RESPONSES=true
export DB_HOST=localhost

# Create uploads directory if it doesn't exist
mkdir -p ./src/backend/uploads
mkdir -p ./src/backend/src/public/uploads

# Change to backend directory and start server
cd ./src/backend

# Check if node_modules exists, if not run npm install
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start the backend server
echo "Starting backend server with mock services..."
npm start