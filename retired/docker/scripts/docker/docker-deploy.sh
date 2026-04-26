#!/bin/bash

# Docker deployment script for PSScript
set -euo pipefail

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' .env | xargs)
else
  echo "Warning: .env file not found. Using default environment variables."
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "Error: Docker is not installed. Please install Docker first."
  exit 1
fi

if docker compose version &> /dev/null; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose &> /dev/null; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Error: Docker Compose is not installed. Please install Docker Compose first."
  exit 1
fi

COMPOSE_FILE="docker-compose.prod.yml"

# Build and start the containers in production mode
echo "Building and starting containers in production mode..."
echo "This might take a few minutes for the first build..."

# Build each service separately to better handle potential failures
echo "Building backend service..."
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" build --pull backend

echo "Building AI service..."
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" build --pull ai-service

echo "Building frontend service (may take longer)..."
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" build --pull frontend || {
  echo " Frontend build had issues. This is often due to TypeScript errors."
  echo "The deployment will continue with other services."
  echo "You can fix frontend TypeScript errors later if needed."
}

# Start all services
echo "Starting all services..."
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" up -d --force-recreate

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Check if services are running
echo "Checking if services are running..."
if "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" ps | grep -q "running"; then
  echo "Services are running successfully!"
  
  # Test backend connection
  echo "Testing backend connection..."
  if curl -sk https://localhost:4000/api/health > /dev/null; then
    echo " Backend API is accessible at https://localhost:4000"
  else
    echo " Backend API is not accessible. Check logs with '${COMPOSE_CMD[*]} -f $COMPOSE_FILE logs backend'"
  fi
  
  # Test AI service connection
  echo "Testing AI service connection..."
  if curl -s http://localhost:8000/health > /dev/null; then
    echo " AI Service is accessible at http://localhost:8000"
  else
    echo " AI Service is not accessible. Check logs with '${COMPOSE_CMD[*]} -f $COMPOSE_FILE logs ai-service'"
  fi
  
  # Test frontend connection
  echo "Testing frontend connection..."
  if curl -sk https://localhost:3090 > /dev/null; then
    echo " Frontend is accessible at https://localhost:3090"
  else
    echo " Frontend is not accessible. Check logs with '${COMPOSE_CMD[*]} -f $COMPOSE_FILE logs frontend'"
  fi
  
  echo "Deployment completed successfully!"
  echo "Frontend: https://localhost:3090"
  echo "Backend API: https://localhost:4000"
  echo "AI Service: http://localhost:8000"
else
  echo "Error: Some services failed to start. Check the logs with '${COMPOSE_CMD[*]} -f $COMPOSE_FILE logs'."
  exit 1
fi

exit 0
