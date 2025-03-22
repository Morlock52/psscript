#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
  echo "No .env file found. Creating from .env.example..."
  cp .env.example .env
  echo "Please edit the .env file with your configuration before continuing."
  exit 1
fi

# Check if OpenAI API key is set
if ! grep -q "OPENAI_API_KEY=" .env || grep -q "OPENAI_API_KEY=$" .env || grep -q "OPENAI_API_KEY=your-openai-api-key" .env; then
  echo "OPENAI_API_KEY is not set in .env file."
  echo "Please edit the .env file and set your OpenAI API key."
  exit 1
fi

# Start the application in development mode
echo "Starting the application in development mode..."
npm run dev
