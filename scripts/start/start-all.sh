#!/bin/bash

# Script to start all services with proper checks and configurations

echo "Starting all services..."

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Creating from .env.example..."
  cp .env.example .env
  echo "Please edit .env file with your configuration and run this script again."
  exit 1
fi

# Check if PostgreSQL is running
echo "Checking PostgreSQL connection..."
node src/backend/test-db.js

# Check if the database connection was successful
if [ $? -ne 0 ]; then
  echo "Error: PostgreSQL connection failed. Make sure PostgreSQL is running."
  echo "You can start PostgreSQL with: brew services start postgresql"
  exit 1
fi

# Check if pgvector extension is installed
echo "Checking pgvector extension..."
./check-pgvector.sh

# Check if the pgvector check was successful
if [ $? -ne 0 ]; then
  echo "Warning: pgvector check failed. Vector operations will be disabled."
  echo "The application will still work, but vector similarity search will not work."
  echo "Install pgvector extension to enable vector operations."
  echo ""
fi

# Update categories in the database
echo "Updating categories in the database..."
./update-db-categories.sh

# Start the backend service in a new terminal
echo "Starting backend service..."
osascript -e 'tell app "Terminal" to do script "cd '$PWD' && ./start-backend-no-mock.sh"'

# Wait for the backend to start
echo "Waiting for backend to start..."
sleep 5

# Start the AI service in a new terminal
echo "Starting AI service..."
osascript -e 'tell app "Terminal" to do script "cd '$PWD' && ./start-ai-service.sh"'

# Wait for the AI service to start
echo "Waiting for AI service to start..."
sleep 5

# Start the frontend service in a new terminal
echo "Starting frontend service..."
osascript -e 'tell app "Terminal" to do script "cd '$PWD' && ./start-frontend.sh"'

echo "All services started successfully."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:4000"
echo "AI Service: http://localhost:8001"
