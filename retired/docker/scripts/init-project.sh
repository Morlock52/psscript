#!/bin/bash

# Initialize project script for PSScript
set -e

echo "Initializing PSScript project..."

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
  echo "Please edit the .env file to set your environment variables."
fi

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p uploads logs

# Set permissions
echo "Setting permissions..."
chmod +x docker-deploy.sh
chmod +x init-project.sh

echo "Project initialized successfully!"
echo "To start the application in development mode, run: docker-compose up -d"
echo "To start the application in production mode, run: ./docker-deploy.sh"

exit 0
