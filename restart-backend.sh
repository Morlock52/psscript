#!/bin/bash

# Stop any running backend processes
echo "Stopping any running backend processes..."
pkill -f "node.*src/backend" || true

# Wait a moment for processes to terminate
sleep 2

# Start the backend server
echo "Starting backend server with new changes..."
./start-backend.sh

echo "Backend server restarted with fixes for script deletion and upload issues."
