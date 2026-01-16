#!/bin/bash

# Function to display messages
show_message() {
  echo -e "\033[1;34m$1\033[0m"
}

# Exit on error
set -e

# Check if .env file exists, if not create it from example
if [ ! -f .env ]; then
  show_message "Creating .env file from example..."
  cp .env.example .env
  show_message "Done! Please edit .env file with your settings."
fi

# Install root dependencies
show_message "Installing root dependencies..."
npm install

# Install frontend dependencies
show_message "Installing frontend dependencies..."
cd src/frontend
npm install
cd ../..

# Install backend dependencies
show_message "Installing backend dependencies..."
cd src/backend
npm install
cd ../..

# Create Python virtual environment for AI service
show_message "Setting up Python environment for AI service..."
cd src/ai
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..

# Setup completed
show_message "\n✅ Setup completed successfully!"
show_message "\nTo start the development servers:"
show_message "1. Frontend: cd src/frontend && npm run dev"
show_message "2. Backend: cd src/backend && npm run dev"
show_message "3. AI Service: cd src/ai && source venv/bin/activate && python -m uvicorn main:app --reload"
show_message "\nOr use Docker: docker-compose up -d"