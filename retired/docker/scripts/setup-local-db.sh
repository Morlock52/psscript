#!/bin/bash

mkdir -p ./src/backend/uploads
mkdir -p ./src/backend/logs
mkdir -p ./test-results/db-tests

echo "Updating database configuration to use localhost..."
sed -i.bak 's/const useDockerHosts = false;/const useDockerHosts = false;/' ./src/backend/src/database/connection.ts

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
EOL

mkdir -p ./src/backend/src/public/uploads
chmod -R 755 ./src/backend/uploads
chmod -R 755 ./src/backend/src/public/uploads

echo "Local backend environment setup complete."
echo "Run 'npm start' from the src/backend directory to start the server." 
