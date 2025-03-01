#!/bin/bash

# Set script to exit on error
set -e

echo "===== Preparing PowerScript project for deployment ====="

# 1. Add .dockerignore files to ignore unnecessary files
echo "Creating .dockerignore files..."

# AI service .dockerignore
cat > ./src/ai/.dockerignore << EOL
venv/
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
.DS_Store
.env
EOL

# Frontend .dockerignore
cat > ./src/frontend/.dockerignore << EOL
node_modules/
dist/
.DS_Store
.env
EOL

# Backend .dockerignore
cat > ./src/backend/.dockerignore << EOL
node_modules/
dist/
.DS_Store
.env
EOL

# Also add a root .dockerignore
cat > ./.dockerignore << EOL
node_modules/
**/node_modules/
**/venv/
**/__pycache__/
**/*.pyc
**/*.pyo
**/*.pyd
**/.DS_Store
**/.env
EOL

# 2. Add all changes to git
echo "Adding all files to git..."
git add .

# 3. Commit the changes
echo "Committing changes..."
git commit -m "Prepare for deployment"

# 4. Push changes to remote (uncomment if you want to push)
# echo "Pushing changes to remote repository..."
# git push

# 5. Test docker compose build locally
echo "Testing docker compose build locally..."
docker compose build

echo "===== Deployment preparation complete ====="
echo "If the local build succeeded, you can now deploy to your target environment."
echo "To deploy manually, run: docker compose up -d"