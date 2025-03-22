#!/bin/bash

# Make the script executable
chmod +x $0

# Set environment variables for mock mode
export NODE_ENV=development
export USE_MOCK_SERVICES=true
export MOCK_MODE=true
export MOCK_AI_RESPONSES=true
export DB_HOST=localhost

# Create necessary directories
mkdir -p ./src/backend/uploads
mkdir -p ./src/backend/logs
mkdir -p ./test-results/db-tests

# Create mock database file
if [ ! -f ./src/backend/mock-db.json ]; then
  echo "{}" > ./src/backend/mock-db.json
  echo "Created mock database file"
fi

# Create .env file if it doesn't exist
if [ ! -f ./src/backend/.env ]; then
  cat > ./src/backend/.env << EOL
NODE_ENV=development
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=psscript
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:8000
JWT_SECRET=development_jwt_secret_key_change_in_production
USE_MOCK_SERVICES=true
MOCK_MODE=true
MOCK_AI_RESPONSES=true
EOL
  echo "Created .env file"
fi

# Change to backend directory
cd ./src/backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start the backend server
echo "Starting backend server in mock mode..."
echo "API will be available at http://localhost:4000"
npm start