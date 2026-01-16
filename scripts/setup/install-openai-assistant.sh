#!/bin/bash

# Script to install and configure an OpenAI Assistant for PSScript
# This script helps create an OpenAI Assistant with the appropriate configuration

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY environment variable is not set."
  echo "Please set your OpenAI API key first:"
  echo "export OPENAI_API_KEY=your_api_key_here"
  exit 1
fi

echo "=== PSScript OpenAI Assistant Setup ==="
echo "This script will create a new OpenAI Assistant for PowerShell scripting."
echo "Make sure you have the OpenAI API key with appropriate permissions."
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed."
  echo "Please install jq first:"
  echo "  - On macOS: brew install jq"
  echo "  - On Ubuntu/Debian: sudo apt-get install jq"
  echo "  - On CentOS/RHEL: sudo yum install jq"
  exit 1
fi

# Check if curl is installed
if ! command -v curl &> /dev/null; then
  echo "Error: curl is required but not installed."
  echo "Please install curl first."
  exit 1
fi

# Define the assistant configuration
ASSISTANT_NAME="PSScript PowerShell Assistant"
ASSISTANT_INSTRUCTIONS="You are a PowerShell expert assistant for the PSScript platform. Your primary role is to help users with PowerShell scripting tasks, provide guidance on best practices, and analyze PowerShell scripts for improvements. When users upload scripts, analyze them for security issues, performance optimizations, and adherence to best practices. Provide clear, concise explanations and always include code examples when appropriate. Maintain context across the conversation to provide personalized assistance."
ASSISTANT_MODEL="gpt-4o"

echo "Creating OpenAI Assistant with the following configuration:"
echo "Name: $ASSISTANT_NAME"
echo "Model: $ASSISTANT_MODEL"
echo ""

# Create the assistant
echo "Creating assistant..."
RESPONSE=$(curl -s -X POST https://api.openai.com/v1/assistants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "OpenAI-Beta: assistants=v1" \
  -d "{
    \"name\": \"$ASSISTANT_NAME\",
    \"instructions\": \"$ASSISTANT_INSTRUCTIONS\",
    \"model\": \"$ASSISTANT_MODEL\",
    \"tools\": [{\"type\": \"code_interpreter\"}]
  }")

# Check if the request was successful
if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
  echo "Error creating assistant:"
  echo "$RESPONSE" | jq -r '.error.message'
  exit 1
fi

# Extract the assistant ID
ASSISTANT_ID=$(echo "$RESPONSE" | jq -r '.id')

if [ -z "$ASSISTANT_ID" ] || [ "$ASSISTANT_ID" == "null" ]; then
  echo "Error: Failed to extract assistant ID from response."
  echo "Response: $RESPONSE"
  exit 1
fi

echo "Success! Assistant created with ID: $ASSISTANT_ID"
echo ""
echo "Please add the following to your .env file:"
echo "OPENAI_ASSISTANT_ID=$ASSISTANT_ID"
echo "ENABLE_OPENAI_ASSISTANT=true"
echo ""
echo "To use the assistant, restart your application with:"
echo "./start-agentic-ai-service.sh"
