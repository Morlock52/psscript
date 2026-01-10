#!/bin/sh
set -e

# Install dependencies if node_modules doesn't exist, is empty, or vite is missing
if [ ! -d "node_modules" ] || [ ! -d "node_modules/vite" ]; then
  echo "Installing dependencies..."
  npm install --legacy-peer-deps
else
  echo "Dependencies already installed, skipping npm install"
fi

# Execute the main command
exec "$@"
