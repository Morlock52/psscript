#!/bin/bash

chmod +x $0

export VITE_USE_MOCKS=true
export VITE_API_URL=http://localhost:4000/api

if [ ! -f ./src/frontend/.env ]; then
  cat > ./src/frontend/.env << EOL
VITE_API_URL=http://localhost:4000/api
VITE_USE_MOCKS=true
VITE_AI_SERVICE_URL=http://localhost:8000
VITE_DOCS_URL=http://localhost:4000
EOL
  echo "Created frontend .env file"
fi

cd ./src/frontend

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting frontend server in mock mode..."
echo "UI will be available at https://127.0.0.1:3090"
npm run dev
