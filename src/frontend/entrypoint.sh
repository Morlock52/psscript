#!/bin/sh
set -e

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --legacy-peer-deps
else
    echo "Dependencies already installed, skipping npm install"
fi

# Determine run mode from environment
RUN_MODE="${RUN_MODE:-dev}"

if [ "$RUN_MODE" = "production" ] || [ "$RUN_MODE" = "preview" ]; then
    echo "Building production bundle..."
    npm run build:prod 2>/dev/null || npx vite build

    echo "Serving production build..."
    npx vite preview --host 0.0.0.0 --port 3000
else
    echo "Starting development server..."
    npm run dev -- --host 0.0.0.0 --port 3000
fi
