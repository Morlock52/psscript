#!/bin/bash

# test-crawl4ai.sh
# This script runs the test-crawl4ai.js script to test the crawl4ai integration.

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Make the test-crawl4ai.js file executable
chmod +x "$SCRIPT_DIR/test-crawl4ai.js"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js and try again."
    exit 1
fi

# Check if crawl4ai is installed
if ! command -v crawl4ai &> /dev/null; then
    echo "crawl4ai is not installed. Installing globally..."
    npm install -g crawl4ai
fi

# Run the test-crawl4ai.js script
echo "Starting crawl4ai integration test..."
node "$SCRIPT_DIR/test-crawl4ai.js"

# Check if the script executed successfully
if [ $? -eq 0 ]; then
    echo "crawl4ai integration test completed successfully!"
else
    echo "Error: crawl4ai integration test failed."
    exit 1
fi
