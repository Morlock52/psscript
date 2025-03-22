#!/bin/bash

# Run database migration for PowerShell Script Vector Database

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running database migration for PowerShell Script Vector Database...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo -e "${RED}Node.js is not installed. Please install Node.js and try again.${NC}"
  exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Run the migration script
node "$SCRIPT_DIR/run-migration.js"

# Check if the migration was successful
if [ $? -ne 0 ]; then
  echo -e "${RED}Migration failed.${NC}"
  exit 1
fi

echo -e "${GREEN}Migration completed successfully.${NC}"
