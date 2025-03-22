#!/bin/bash

# Stop any running frontend processes
echo "Stopping any running frontend processes..."
pkill -f "node.*src/frontend" || true

# Wait a moment for processes to terminate
sleep 2

# Start the frontend server
echo "Starting frontend server with new changes..."
./start-frontend.sh

echo "Frontend server restarted with fixes for script deletion and upload issues."
