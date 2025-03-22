#!/bin/bash

# Start the PowerShell Script Vector Database server

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting PowerShell Script Vector Database server...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo -e "${RED}Node.js is not installed. Please install Node.js and try again.${NC}"
  exit 1
fi

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

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Create necessary directories
mkdir -p "$SCRIPT_DIR/logs" "$SCRIPT_DIR/uploads" "$SCRIPT_DIR/data"

# Check if database migration has been run
echo -e "${YELLOW}Checking database connection...${NC}"
node "$SCRIPT_DIR/bin/test-db.js"

if [ $? -ne 0 ]; then
  echo -e "${RED}Database connection failed. Please check your database configuration in .env file.${NC}"
  exit 1
fi

# Start the server
echo -e "${YELLOW}Starting server...${NC}"
node "$SCRIPT_DIR/index.js"
