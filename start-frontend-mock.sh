#!/bin/bash

# Make the script executable
chmod +x $0

# Set environment variables
export VITE_USE_MOCKS=true
export VITE_API_URL=http://localhost:4000/api

# Create a .env file for the frontend if it doesn't exist
if [ ! -f ./src/frontend/.env ]; then
  cat > ./src/frontend/.env << EOL
VITE_API_URL=http://localhost:4000/api
VITE_USE_MOCKS=true
VITE_AI_SERVICE_URL=http://localhost:8000
EOL
  echo "Created frontend .env file"
fi

# Change to frontend directory
cd ./src/frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start the frontend server
echo "Starting frontend server in mock mode..."
echo "UI will be available at http://localhost:3000"
npm run dev