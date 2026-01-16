# PSScript

A multi-service PowerShell script analysis platform with agentic AI capabilities.

## Overview

PSScript provides intelligent analysis, generation, and management of PowerShell scripts with features including:

- **AI-Powered Analysis** - Security scanning, code quality assessment, and best practice validation
- **Script Generation** - Agentic AI workflow for generating PowerShell scripts from natural language
- **Semantic Search** - Vector embeddings for finding similar scripts and documentation
- **Version Control** - Track script versions with changelogs
- **Collaboration** - Comments, favorites, and user management

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PSScript Platform                       │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  Frontend   │   Backend   │ AI Service  │   Data Layer     │
│  React/Vite │  Express/TS │ FastAPI/Py  │  PostgreSQL      │
│  Port 3000  │  Port 4000  │  Port 8000  │  + Redis Cache   │
└─────────────┴─────────────┴─────────────┴──────────────────┘
```

| Service | Technology | Port | Description |
|---------|------------|------|-------------|
| Frontend | React + Vite | 3000 | Web application UI |
| Backend | Express + TypeScript | 4000 | API server with agentic tools |
| AI Service | FastAPI + Python | 8000 | AI/ML operations |
| PostgreSQL | PostgreSQL 15+ | 5432 | Primary database with pgvector |
| Redis | Redis 7+ | 6379 | Caching layer |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker & Docker Compose
- PostgreSQL 15+ with pgvector extension
- Redis 7+

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd psscript

# Start all services with Docker
docker-compose up

# Or start services individually:

# Backend
cd src/backend && npm install && npm run dev

# Frontend
cd src/frontend && npm install && npm run dev

# AI Service
cd src/ai && python main.py
```

### Production Deployment

```bash
# Build and start production containers
docker-compose -f docker-compose.prod.yml up -d

# For Cloudflare Tunnel access
./scripts/start-frontend-prod.sh
```

## Project Structure

```
psscript/
├── src/
│   ├── backend/           # Express/TypeScript API
│   │   ├── src/
│   │   │   ├── controllers/    # API route handlers
│   │   │   ├── models/         # Sequelize ORM models
│   │   │   ├── services/       # Business logic
│   │   │   │   └── agentic/    # AI workflow engine
│   │   │   └── database/       # DB connection
│   │   └── tests/
│   ├── frontend/          # React/Vite application
│   │   └── src/
│   │       ├── components/     # React components
│   │       ├── pages/          # Route pages
│   │       └── services/       # API clients
│   └── ai/                # Python AI service
│       ├── main.py            # FastAPI server
│       └── voice_endpoints.py # Voice API
├── docs/                  # Documentation
├── scripts/               # Utility scripts
└── docker/                # Docker configurations
```

## Key Features

### Agentic AI System

The backend includes a sophisticated agentic workflow system:

- **RunEngine** (`src/backend/src/services/agentic/RunEngine.ts`) - Orchestrates multi-step AI workflows
- **ScriptGenerator** - Generates PowerShell scripts from requirements
- **SecurityAnalyzer** - Performs security analysis and vulnerability detection
- **Modular Tools** - Extensible tool system for AI operations

### Database Features

- **File Hash Deduplication** - Prevents duplicate script storage
- **Vector Embeddings** - 1536-dimension vectors for semantic search (pgvector)
- **Version History** - Complete script version tracking
- **Real-time Updates** - WebSocket connections for live updates

### Security

- **JWT Authentication** - Secure token-based auth
- **Cloudflare Access** - Optional SSO integration
- **Security Analysis** - Built-in script security scanning
- **Input Validation** - Comprehensive request validation

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](./CLAUDE.md) | Development guide for Claude Code |
| [docs/DATABASE_REVIEW_2026.md](./docs/DATABASE_REVIEW_2026.md) | Database architecture and optimization |
| [docs/DOCKER-SETUP.md](./docs/DOCKER-SETUP.md) | Docker deployment guide |

## Commands Reference

### Development

```bash
# Start all services
docker-compose up

# Run tests
cd src/backend && npm test

# Lint code
npm run lint          # All
npm run lint:backend  # Backend only
npm run lint:frontend # Frontend only

# Type checking
cd src/backend && npm run typecheck
```

### Port Management

```bash
# Check port usage
./scripts/ensure-ports.sh status

# Free ports if needed
./scripts/ensure-ports.sh kill-frontend
./scripts/ensure-ports.sh kill-backend
```

### Database

```bash
# Test database connectivity
cd src/backend && node test-db.js

# Test Redis connectivity
cd src/backend && node test-redis.js
```

## API Endpoints

### Scripts
- `GET /api/scripts` - List scripts
- `POST /api/scripts` - Create script
- `GET /api/scripts/:id` - Get script details
- `POST /api/scripts/:id/analyze` - Analyze script

### AI Operations
- `POST /api/ai/generate` - Generate script from prompt
- `POST /api/ai/chat` - Chat with AI assistant
- `GET /api/ai/search` - Semantic search

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Current user info

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

---

**Status:** Active Development
**Last Updated:** January 2026
