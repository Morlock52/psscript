#!/bin/bash
# Script to start the AI service with agentic capabilities

# Load environment variables
if [ -f .env ]; then
    echo "Loading environment variables from .env file"
    export $(grep -v '^#' .env | xargs)
else
    echo "No .env file found, using default environment variables"
    # Default environment variables
    export OPENAI_API_KEY="your-api-key-here"
    export OPENAI_MODEL="gpt-4"
    export AGENT_TYPE="auto"  # auto, langchain, autogpt, hybrid, langgraph, pyg
    export ENABLE_AGENTIC_CAPABILITIES="true"
    export ENABLE_TOOL_USE="true"
    export ENABLE_PLANNING="true"
    export ENABLE_STATE_MANAGEMENT="true"
    export ENABLE_ERROR_HANDLING="true"
    export ENABLE_EXTERNAL_API="true"
    export LOG_LEVEL="info"
    export PORT=3001
    export HOST="0.0.0.0"
    export DB_HOST="localhost"
    export DB_PORT=5432
    export DB_NAME="psscript"
    export DB_USER="postgres"
    export DB_PASSWORD="postgres"
    export REDIS_URL="redis://localhost:6379/0"
    export CACHE_ENABLED="true"
    export CACHE_TTL=3600
fi

# Check if the database is ready
echo "Checking database connection..."
if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1; then
    echo "Error: Cannot connect to the database. Make sure the database is running and the connection details are correct."
    exit 1
fi

# Check if the required tables exist
echo "Checking if agent tables exist..."
AGENT_STATE_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_state';")
if [ $AGENT_STATE_COUNT -eq 0 ]; then
    echo "Warning: agent_state table does not exist. Run the migration script first."
    read -p "Do you want to run the migration script now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Running migration script..."
        ./run-agent-tables-migration.sh
    else
        echo "Continuing without running the migration script. Some features may not work correctly."
    fi
fi

# Check if the required dependencies are installed
echo "Checking if required dependencies are installed..."
if ! python -c "import langgraph" 2>/dev/null; then
    echo "Warning: LangGraph is not installed. Some features may not work correctly."
    read -p "Do you want to install the dependencies now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing dependencies..."
        ./install-agentic-dependencies.sh
    else
        echo "Continuing without installing dependencies. Some features may not work correctly."
    fi
fi

# Start the AI service
echo "Starting AI service with agentic capabilities..."
echo "Agent type: $AGENT_TYPE"
echo "Agentic capabilities: $ENABLE_AGENTIC_CAPABILITIES"
echo "Tool use: $ENABLE_TOOL_USE"
echo "Planning: $ENABLE_PLANNING"
echo "State management: $ENABLE_STATE_MANAGEMENT"
echo "Error handling: $ENABLE_ERROR_HANDLING"
echo "External API: $ENABLE_EXTERNAL_API"
echo "Log level: $LOG_LEVEL"
echo "Port: $PORT"
echo "Host: $HOST"

# Start the AI service
cd src/ai && python main.py
