#!/bin/bash

# Setup and push the PowerShell Script Vector Database to GitHub

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up PowerShell Script Vector Database...${NC}"

# Check if git is installed
if ! command -v git &> /dev/null; then
  echo -e "${RED}Git is not installed. Please install Git and try again.${NC}"
  exit 1
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
  echo -e "${YELLOW}GitHub CLI is not installed. You will need to create the repository manually.${NC}"
  USE_GH_CLI=false
else
  USE_GH_CLI=true
fi

# Initialize git repository if not already initialized
if [ ! -d ".git" ]; then
  echo -e "${YELLOW}Initializing Git repository...${NC}"
  git init
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to initialize Git repository.${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}Git repository initialized successfully.${NC}"
else
  echo -e "${YELLOW}Git repository already initialized.${NC}"
fi

# Create .gitignore file
echo -e "${YELLOW}Creating .gitignore file...${NC}"
cat > .gitignore << EOL
# Node.js
node_modules/
npm-debug.log
yarn-debug.log
yarn-error.log

# Environment variables
.env
.env.local
.env.development
.env.test
.env.production

# Logs
logs/
*.log

# Data
data/
uploads/

# IDE
.idea/
.vscode/
*.sublime-project
*.sublime-workspace

# OS
.DS_Store
Thumbs.db
EOL

echo -e "${GREEN}.gitignore file created successfully.${NC}"

# Add all files to git
echo -e "${YELLOW}Adding files to Git...${NC}"
git add .

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to add files to Git.${NC}"
  exit 1
fi

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git commit -m "Initial commit"

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to commit changes.${NC}"
  exit 1
fi

echo -e "${GREEN}Changes committed successfully.${NC}"

# Create GitHub repository if GitHub CLI is installed
if [ "$USE_GH_CLI" = true ]; then
  echo -e "${YELLOW}Creating GitHub repository...${NC}"
  
  # Ask for repository name
  read -p "Enter repository name (default: psscript-vector-db): " REPO_NAME
  REPO_NAME=${REPO_NAME:-psscript-vector-db}
  
  # Ask for repository description
  read -p "Enter repository description (default: PowerShell Script Vector Database): " REPO_DESC
  REPO_DESC=${REPO_DESC:-PowerShell Script Vector Database}
  
  # Ask if repository should be private
  read -p "Make repository private? (y/n, default: n): " PRIVATE
  PRIVATE=${PRIVATE:-n}
  
  if [ "$PRIVATE" = "y" ] || [ "$PRIVATE" = "Y" ]; then
    PRIVATE_FLAG="--private"
  else
    PRIVATE_FLAG="--public"
  fi
  
  # Create repository
  gh repo create "$REPO_NAME" --description "$REPO_DESC" $PRIVATE_FLAG --source=. --remote=origin --push
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to create GitHub repository.${NC}"
    echo -e "${YELLOW}You can create the repository manually and push the changes.${NC}"
    echo -e "${YELLOW}git remote add origin https://github.com/yourusername/$REPO_NAME.git${NC}"
    echo -e "${YELLOW}git push -u origin main${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}GitHub repository created successfully.${NC}"
else
  echo -e "${YELLOW}Please create a GitHub repository manually and push the changes.${NC}"
  echo -e "${YELLOW}git remote add origin https://github.com/yourusername/psscript-vector-db.git${NC}"
  echo -e "${YELLOW}git push -u origin main${NC}"
fi

echo -e "${GREEN}Setup completed successfully!${NC}"
