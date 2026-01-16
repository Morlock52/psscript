#!/bin/bash
# Script to start all services with agentic capabilities

# Set the terminal title
echo -e "\033]0;PSScript - All Services with Agentic Capabilities\007"

# Print a welcome message
echo "Starting all services with agentic capabilities..."
echo "This script will start the database, backend with OpenAI Assistants API, AI service, and frontend."
echo "Press Ctrl+C to stop all services."

# Check if the database is running
echo "Checking if the database is running..."
if ! pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; then
    echo "Starting PostgreSQL database..."
    # Start PostgreSQL (this command may vary depending on your system)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew services start postgresql
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo service postgresql start
    else
        # Windows or other
        echo "Please start PostgreSQL manually."
    fi
else
    echo "PostgreSQL database is already running."
fi

# Check if pgvector extension is installed
echo "Checking if pgvector extension is installed..."
./check-pgvector.sh
PGVECTOR_STATUS=$?

if [ $PGVECTOR_STATUS -ne 0 ]; then
    echo "pgvector extension is not installed or not working properly."
    echo "Vector search functionality will be disabled."
else
    echo "pgvector extension is installed and working properly."
    echo "Vector search functionality will be enabled."
fi

# Run the database migration for agent tables
echo "Running database migration for agent tables..."
./run-agent-tables-migration.sh

# Install OpenAI Assistants API dependencies
echo "Installing OpenAI Assistants API dependencies..."
./install-openai-assistant.sh

# Install other agentic dependencies
echo "Installing other agentic dependencies..."
./install-agentic-dependencies.sh

# Check for OpenAI API key
if grep -q "OPENAI_API_KEY=your-api-key-here" .env; then
    echo "⚠️  WARNING: OpenAI API key is not set in the .env file."
    echo "Some agentic features may not work properly."
    echo "Please edit the .env file and set your OpenAI API key."
    echo "Continuing startup process..."
else
    echo "OpenAI API key found in .env file."
fi

# Start the backend service
echo "Starting backend service on port 4000..."
./start-backend-no-mock.sh &
BACKEND_PID=$!
echo "Backend service started with PID $BACKEND_PID"

# Wait for the backend to start
echo "Waiting for the backend to start..."
sleep 5

# Start the AI service with agentic capabilities
echo "Starting AI service with agentic capabilities..."
./start-agentic-ai-service.sh &
AI_PID=$!
echo "AI service started with PID $AI_PID"

# Wait for the AI service to start
echo "Waiting for the AI service to start..."
sleep 5

# Start the frontend
echo "Starting frontend on port 3002..."
./start-frontend.sh &
FRONTEND_PID=$!
echo "Frontend started with PID $FRONTEND_PID"

# Wait for the frontend to start
echo "Waiting for the frontend to start..."
sleep 5

# Print a success message
echo "All services started successfully!"
echo "Backend API: http://localhost:4000"
echo "AI Service: http://localhost:3001"
echo "Frontend: http://localhost:3002"
echo "Press Ctrl+C to stop all services."

# Print OpenAI Assistants API endpoints
echo ""
echo "OpenAI Assistants API endpoints available:"
echo "- http://localhost:4000/chat (with agent_type='assistant')"
echo "- http://localhost:4000/analyze/assistant"
echo ""

# Wait for Ctrl+C
trap "echo 'Stopping all services...'; kill $BACKEND_PID $AI_PID $FRONTEND_PID; echo 'All services stopped.'; exit 0" INT
wait
