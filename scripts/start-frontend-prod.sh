#!/bin/bash
# Start frontend production server on port 3000
# Kills any conflicting process first

FRONTEND_PORT=3000
FRONTEND_DIR="$(dirname "$0")/../src/frontend"

cd "$FRONTEND_DIR" || exit 1

# Kill any process on port 3000
pid=$(lsof -ti :$FRONTEND_PORT 2>/dev/null)
if [ -n "$pid" ]; then
    echo "Killing existing process on port $FRONTEND_PORT (PID: $pid)..."
    kill -9 $pid 2>/dev/null
    sleep 1
fi

# Check if dist exists, build if not
if [ ! -d "dist" ]; then
    echo "Building frontend for production..."
    npm run build
fi

# Start production server
echo "Starting frontend production server on port $FRONTEND_PORT..."
PORT=$FRONTEND_PORT node server.js
