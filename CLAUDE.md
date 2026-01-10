# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Docker Development
- `docker-compose up` - Start all services (backend, frontend, AI, PostgreSQL, Redis)
- `docker-compose down` - Stop all services
- `./start-all-agentic.sh` - Start the complete agentic system

### Backend (TypeScript/Node.js)
- `cd src/backend && npm run dev` - Start backend in development mode
- `cd src/backend && npm run build` - Build TypeScript to JavaScript
- `cd src/backend && npm test` - Run backend tests
- `cd src/backend && npm run lint` - Lint backend code
- `cd src/backend && npm run typecheck` - TypeScript type checking

### Frontend (React/Vite)
- `cd src/frontend && npm run dev` - Start frontend development server
- `cd src/frontend && npm run build` - Build frontend for production
- `cd src/frontend && npm run preview` - Preview production build

### AI Service (Python/FastAPI)
- `cd src/ai && python main.py` - Start AI service directly
- AI service runs on port 8001 by default

## Architecture Overview

This is a multi-service PowerShell script analysis platform with agentic AI capabilities:

### Core Services
1. **Backend** (`src/backend/`) - TypeScript/Express API server
2. **Frontend** (`src/frontend/`) - React/Vite web application  
3. **AI Service** (`src/ai/`) - Python/FastAPI service for AI operations
4. **Database** - PostgreSQL with Redis for caching

### Key Backend Components

#### Agentic System (`src/backend/src/services/agentic/`)
- **RunEngine.ts** - Orchestrates multi-step AI workflows and tool execution
- **tools/** - Modular AI tools for script analysis:
  - `ScriptGenerator.ts` - Generates PowerShell scripts
  - `SecurityAnalyzer.ts` - Performs security analysis
  - Additional tools for various analysis tasks

#### Controllers
- **ScriptController.ts** - Main API for script operations and analysis
- **AsyncUploadController.ts** - Handles file uploads with progress tracking

#### Database Integration
- **connection.ts** - Centralized database connection management
- **models/index.ts** - Sequelize models and relationships
- Uses file hash deduplication to prevent duplicate script storage

### AI Service Architecture
- **main.py** - FastAPI server with multiple AI endpoints
- **voice_endpoints.py** - Voice interaction capabilities
- Integrates with vector database for semantic search
- Supports multiple AI models and providers

### Data Flow
1. Scripts uploaded via frontend → AsyncUploadController
2. File hash checked for deduplication → Database storage
3. Analysis requests → RunEngine → AI tools → Results
4. Vector embeddings stored for semantic search
5. Real-time updates via WebSocket connections

## Development Notes

### Database Schema
- Scripts stored with file hash deduplication
- Analysis results cached in Redis
- Vector embeddings for semantic search capabilities

### Authentication & Security
- JWT-based authentication system
- Security analysis integrated into workflow
- File hash validation prevents malicious uploads

### AI Integration
- Multiple AI providers supported (OpenAI, Anthropic)
- Agentic workflow system for complex multi-step operations
- Vector database integration for contextual search
- Voice API endpoints for speech interaction

### Testing
- Backend tests focus on API endpoints and agentic tools
- Use existing test commands in respective package.json files
- Integration tests cover database operations and AI workflows