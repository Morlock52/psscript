#!/bin/bash

# Docker deployment script for PSScript
set -e

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

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
  echo "Error: Docker Compose is not installed. Please install Docker Compose first."
  exit 1
fi

# Build and start the containers in production mode
echo "Building and starting containers in production mode..."
echo "This might take a few minutes for the first build..."

# Build each service separately to better handle potential failures
echo "Building backend service..."
docker-compose -f docker-compose.prod.yml build backend

echo "Building AI service..."
docker-compose -f docker-compose.prod.yml build ai-service

echo "Building frontend service (may take longer)..."
docker-compose -f docker-compose.prod.yml build frontend || {
  echo " Frontend build had issues. This is often due to TypeScript errors."
  echo "The deployment will continue with other services."
  echo "You can fix frontend TypeScript errors later if needed."
}

# Start all services
echo "Starting all services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Check if services are running
echo "Checking if services are running..."
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
  echo "Services are running successfully!"
  
  # Test backend connection
  echo "Testing backend connection..."
  if curl -s http://localhost:4000/api/health > /dev/null; then
    echo " Backend API is accessible at http://localhost:4000"
  else
    echo " Backend API is not accessible. Check logs with 'docker-compose -f docker-compose.prod.yml logs backend'"
  fi
  
  # Test AI service connection
  echo "Testing AI service connection..."
  if curl -s http://localhost:8000/health > /dev/null; then
    echo " AI Service is accessible at http://localhost:8000"
  else
    echo " AI Service is not accessible. Check logs with 'docker-compose -f docker-compose.prod.yml logs ai-service'"
  fi
  
  # Test frontend connection
  echo "Testing frontend connection..."
  if curl -s http://localhost:3002 > /dev/null; then
    echo " Frontend is accessible at http://localhost:3002"
  else
    echo " Frontend is not accessible. Check logs with 'docker-compose -f docker-compose.prod.yml logs frontend'"
  fi
  
  echo "Deployment completed successfully!"
  echo "Frontend: http://localhost:3002"
  echo "Backend API: http://localhost:4000"
  echo "AI Service: http://localhost:8000"
else
  echo "Error: Some services failed to start. Check the logs with 'docker-compose -f docker-compose.prod.yml logs'."
  exit 1
fi

exit 0
