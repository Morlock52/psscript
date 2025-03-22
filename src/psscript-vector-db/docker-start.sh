#!/bin/bash

# Start the PowerShell Script Vector Database using Docker Compose

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting PowerShell Script Vector Database with Docker...${NC}"

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
  cp .env.example .env
  echo -e "${RED}Please edit the .env file to add your database credentials and OpenAI API key.${NC}"
  echo -e "${RED}Then run this script again.${NC}"
  exit 1
fi

# Check if OpenAI API key is set
if ! grep -q "OPENAI_API_KEY=" .env || grep -q "OPENAI_API_KEY=$" .env || grep -q "OPENAI_API_KEY=your_openai_api_key" .env; then
  echo -e "${RED}OpenAI API key is not set in .env file.${NC}"
  echo -e "${RED}Please edit the .env file to add your OpenAI API key.${NC}"
  exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker is not installed. Please install Docker and try again.${NC}"
  exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}Docker Compose is not installed. Please install Docker Compose and try again.${NC}"
  exit 1
fi

# Create necessary directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p logs uploads data

# Build and start the containers
echo -e "${YELLOW}Building and starting Docker containers...${NC}"
docker-compose up --build -d

# Check if the containers are running
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to start Docker containers.${NC}"
  exit 1
fi

echo -e "${GREEN}Docker containers started successfully!${NC}"
echo -e "${GREEN}API server is running at http://localhost:${PORT:-3000}${NC}"
echo -e "${GREEN}pgAdmin is running at http://localhost:5050${NC}"
echo -e "${GREEN}PostgreSQL is running at localhost:${DB_PORT:-5432}${NC}"

# Show running containers
echo -e "${YELLOW}Running containers:${NC}"
docker-compose ps

echo -e "${YELLOW}To stop the containers, run:${NC}"
echo -e "${YELLOW}docker-compose down${NC}"

echo -e "${YELLOW}To view logs, run:${NC}"
echo -e "${YELLOW}docker-compose logs -f${NC}"
