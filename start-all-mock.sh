#!/bin/bash

# Make the script executable
chmod +x $0

# Print banner
echo "=========================================================="
echo "Starting PSScript in Mock Mode"
echo "No databases or external services required"
echo "=========================================================="

# Create necessary directories and files
mkdir -p ./src/backend/uploads
mkdir -p ./src/backend/logs
mkdir -p ./test-results/db-tests
mkdir -p ./src/backend/src/public/uploads

# Ensure scripts are executable
chmod +x ./start-backend-mock.sh
chmod +x ./start-frontend-mock.sh

# Start backend in background
echo "Starting backend server..."
./start-backend-mock.sh &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Start frontend
echo "Starting frontend server..."
./start-frontend-mock.sh

# When frontend exits, kill backend
kill $BACKEND_PID

echo "Application stopped."