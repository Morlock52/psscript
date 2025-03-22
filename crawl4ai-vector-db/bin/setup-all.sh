#!/bin/bash

# Make all scripts executable
echo "Making scripts executable..."
npm run make-executable
npm run make-shell-executable

# Run the setup script
echo "Running setup script..."
npm run setup

# Initialize the database
echo "Initializing database..."
npm run init-db

echo "Setup complete! You can now start the server with:"
echo "npm start"
