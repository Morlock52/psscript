#!/bin/bash

# run-tests.sh
# This script runs all tests for the psscript-vector-db module.

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Make the test-all.js file executable
chmod +x "$SCRIPT_DIR/test-all.js"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js and try again."
    exit 1
fi

# Run the test-all.js script
echo "Starting all tests for psscript-vector-db..."
node "$SCRIPT_DIR/test-all.js"

# Check if the script executed successfully
if [ $? -eq 0 ]; then
    echo "All tests completed successfully!"
else
    echo "Error: Some tests failed. Please check the output above for details."
    exit 1
fi
