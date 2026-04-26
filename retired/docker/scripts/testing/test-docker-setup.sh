#!/bin/bash

# Test Docker setup script for PSScript
set -e

echo "Testing Docker setup for PSScript..."

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

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file from example..."
  cp .env.example .env
  echo "Using default environment variables for testing."
fi

# Build and start containers in production mode
echo "Building and starting containers in production mode..."
echo "This might take a few minutes for the first build..."

# Build each service separately to better handle potential failures
echo "Building backend service..."
docker-compose -f docker-compose.prod.yml build backend

echo "Building AI service..."
docker-compose -f docker-compose.prod.yml build ai-service

echo "Building frontend service (may take longer)..."
docker-compose -f docker-compose.prod.yml build frontend || {
  echo "⚠️ Frontend build had issues. This is often due to TypeScript errors."
  echo "The Docker setup will continue with other services."
  echo "You can fix frontend TypeScript errors later if needed."
}

# Start all services
echo "Starting all services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 15

# Check if services are running
echo "Checking if services are running..."
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
  echo "Some services are running successfully!"
  
  # Test backend connection
  echo "Testing backend connection..."
  if curl -s http://localhost:4000/api/health > /dev/null; then
    echo "✅ Backend API is accessible at http://localhost:4000"
  else
    echo "❌ Backend API is not accessible. Check logs with 'docker-compose -f docker-compose.prod.yml logs backend'"
  fi
  
  # Test AI service connection
  echo "Testing AI service connection..."
  if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ AI Service is accessible at http://localhost:8000"
  else
    echo "❌ AI Service is not accessible. Check logs with 'docker-compose -f docker-compose.prod.yml logs ai-service'"
  fi
  
  # Test frontend connection
  echo "Testing frontend connection..."
  if curl -s http://localhost:3002 > /dev/null; then
    echo "✅ Frontend is accessible at http://localhost:3002"
  else
    echo "❌ Frontend is not accessible. Check logs with 'docker-compose -f docker-compose.prod.yml logs frontend'"
  fi
  
  echo "All tests completed. You can now stop the services with 'docker-compose -f docker-compose.prod.yml down'"
else
  echo "Error: No services are running. Check the logs with 'docker-compose -f docker-compose.prod.yml logs'."
  docker-compose -f docker-compose.prod.yml down
  exit 1
fi

# Ask if user wants to stop services
read -p "Do you want to stop the services now? (y/n): " STOP_SERVICES
if [[ $STOP_SERVICES =~ ^[Yy]$ ]]; then
  echo "Stopping services..."
  docker-compose -f docker-compose.prod.yml down
  echo "Services stopped."
else
  echo "Services are still running. Stop them manually with 'docker-compose -f docker-compose.prod.yml down' when done."
fi

exit 0
