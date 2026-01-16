#!/bin/bash

# Create required directories
mkdir -p ./src/backend/uploads
mkdir -p ./src/backend/logs
mkdir -p ./test-results/db-tests

# Update our database connection to use localhost
echo "Updating database configuration to use localhost..."
sed -i.bak 's/const useDockerHosts = false;/const useDockerHosts = false;/' ./src/backend/src/database/connection.ts

# Create mock database file if needed
echo "Setting up local mock database..."
touch ./src/backend/mock-db.json

# Create env file for local development
echo "Creating environment file for development..."
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

# Create uploads directory within public
mkdir -p ./src/backend/src/public/uploads

# Set permissions
chmod -R 755 ./src/backend/uploads
chmod -R 755 ./src/backend/src/public/uploads

echo "Local development environment setup complete. Using mock services for database and Redis."
echo "Run 'npm start' from the src/backend directory to start the server."