#!/bin/bash

# Script to disable mock mode and restart the backend server

# Stop any running backend server
echo "Stopping any running backend server..."
pkill -f "node.*src/index.ts" || true

# Create a temporary file with the modified content
echo "Modifying index.ts to disable mock mode..."
sed 's/process.env.USE_MOCK_SERVICES = '\''true'\''/process.env.USE_MOCK_SERVICES = '\''false'\''/' src/backend/src/index.ts > src/backend/src/index.ts.tmp

# Replace the original file with the modified content
mv src/backend/src/index.ts.tmp src/backend/src/index.ts

echo "Mock mode disabled. Restarting backend server..."
./start-backend.sh
