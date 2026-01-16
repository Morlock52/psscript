#!/bin/bash

# Change to frontend directory
cd src/frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

# Start frontend development server
echo "Starting frontend development server..."
npm run dev