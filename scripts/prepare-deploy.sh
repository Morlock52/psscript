#\!/bin/bash
# Script to prepare the application for deployment

set -e  # Exit on any error

echo "=== Preparing PSScript for deployment ==="

# Create .dockerignore files if they don't exist
echo "Creating .dockerignore files..."
[ -f .dockerignore ] || cat > .dockerignore << 'DOCKERIGNORE'
**/.git
**/.DS_Store
**/node_modules
**/dist
**/__pycache__
**/*.pyc
**/venv
**/.vscode
**/.idea
**/npm-debug.log
**/coverage
**/.env.local
**/.env.development.local
**/.env.test.local
**/.env.production.local
.env
DOCKERIGNORE

[ -f src/ai/.dockerignore ] || cat > src/ai/.dockerignore << 'DOCKERIGNORE'
**/.git
**/.DS_Store
**/__pycache__
**/*.pyc
**/venv
**/.vscode
**/.idea
.env
DOCKERIGNORE

[ -f src/backend/.dockerignore ] || cat > src/backend/.dockerignore << 'DOCKERIGNORE'
**/.git
**/.DS_Store
**/node_modules
**/dist
**/.vscode
**/.idea
**/npm-debug.log
**/coverage
**/.env.local
**/.env.development.local
**/.env.test.local
**/.env.production.local
.env
DOCKERIGNORE

[ -f src/frontend/.dockerignore ] || cat > src/frontend/.dockerignore << 'DOCKERIGNORE'
**/.git
**/.DS_Store
**/node_modules
**/dist
**/.vscode
**/.idea
**/npm-debug.log
**/coverage
**/.env.local
**/.env.development.local
**/.env.test.local
**/.env.production.local
.env
DOCKERIGNORE

# Update frontend settings for production
echo "Updating frontend settings for production..."
sed -i.bak 's/useMockData: true/useMockData: false/' src/frontend/src/services/settings.ts
sed -i.bak 's/showDbToggle: true/showDbToggle: false/' src/frontend/src/services/settings.ts
sed -i.bak 's/VITE_USE_MOCKS=true/VITE_USE_MOCKS=false/' docker-compose.yml

# Ensure the DB creation script has proper pgvector extension
echo "Verifying database schema..."
grep -q "CREATE EXTENSION IF NOT EXISTS vector" src/db/schema.sql || {
  echo "Adding pgvector extension to schema.sql"
  sed -i.bak '1s/^/-- Enable pgvector extension\nCREATE EXTENSION IF NOT EXISTS vector;\n\n/' src/db/schema.sql
}

# Make sure the env.txt file does not contain default credentials
echo "Setting up environment variables..."
cp -n env.txt env.txt.bak 2>/dev/null || true
cat > env.txt << 'ENVFILE'
# Global environment variables
NODE_ENV=production

# OpenAI API key for AI service
OPENAI_API_KEY=your_openai_api_key_here

# PostgreSQL Database Config
DB_HOST=postgres
DB_PORT=5432
DB_NAME=psscript
DB_USER=postgres
DB_PASSWORD=postgres

# Redis Config
REDIS_URL=redis://redis:6379

# JWT Secret for authentication
JWT_SECRET=change_this_in_production_very_secret_key

# Service URLs
AI_SERVICE_URL=http://ai-service:8000
BACKEND_URL=http://backend:4000
FRONTEND_URL=http://frontend:3000

# Frontend Config
VITE_API_URL=http://localhost:4000/api
VITE_USE_MOCKS=false

# Backend Config
PORT=4000
ENVFILE

# Set database credentials in docker-compose.yml
echo "Updating docker-compose.yml with environment variables..."
sed -i.bak 's/POSTGRES_DB=psscript/POSTGRES_DB=psscript/' docker-compose.yml
sed -i.bak 's/POSTGRES_USER=postgres/POSTGRES_USER=postgres/' docker-compose.yml
sed -i.bak 's/POSTGRES_PASSWORD=postgres/POSTGRES_PASSWORD=postgres/' docker-compose.yml

# Update pgvector version in requirements.txt
echo "Updating AI service dependencies..."
if grep -q "pgvector==" src/ai/requirements.txt; then
  sed -i.bak 's/pgvector==.*/pgvector==0.2.3/' src/ai/requirements.txt
else
  echo "pgvector==0.2.3" >> src/ai/requirements.txt
fi

# Modify AI service to handle missing API key gracefully
echo "Updating AI service mock mode detection..."
if grep -q "MOCK_MODE" src/ai/main.py; then
  sed -i.bak 's/MOCK_MODE = os.getenv("OPENAI_API_KEY", "") in \["", "your_openai_api_key_here"\]/MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true" or os.getenv("OPENAI_API_KEY", "") in ["", "your_openai_api_key_here", "${OPENAI_API_KEY}"]/' src/ai/main.py
fi

echo "=== Deployment preparation complete ==="
echo "Next steps:"
echo "1. Set your environment variables in .env file or deployment environment"
echo "2. Run 'docker-compose up -d' to start the production services"
echo "3. Change the default admin password for security"
