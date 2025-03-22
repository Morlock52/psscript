#!/bin/bash

# Script to start the AI service with pgvector check

echo "Starting AI service with pgvector check..."

# Check if pgvector is installed
echo "Checking pgvector extension..."
./check-pgvector.sh

# Check if the pgvector check was successful
if [ $? -ne 0 ]; then
  echo "Warning: pgvector check failed. Vector operations will be disabled."
  echo "The AI service will still start, but vector similarity search will not work."
  echo "Install pgvector extension to enable vector operations."
  echo ""
fi

# Set environment variables
export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Warning: OPENAI_API_KEY not found in .env file."
  echo "The AI service will run in mock mode."
  export MOCK_MODE=true
else
  echo "Using OpenAI API key from .env file."
  export MOCK_MODE=false
fi

# Start the AI service
echo "Starting AI service..."
cd src/ai && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
