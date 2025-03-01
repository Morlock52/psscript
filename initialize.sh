#!/bin/bash

# Initialize Git repository
git init

# Copy environment example to .env
cp .env.example .env

# Create necessary directories
mkdir -p logs
mkdir -p src/db/seeds

# Initialize Git repository
git add .
git commit -m "Initial commit: PowerShell Script Management Application"

echo "Project initialized successfully!"
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Run 'npm run install:all' to install dependencies"
echo "3. Run 'npm run dev' to start the development servers"