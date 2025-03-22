#!/bin/bash

# Run all tests
echo "Running all tests..."
npm test

# Exit with the same status code as the tests
exit $?
