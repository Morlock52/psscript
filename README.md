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
- Docker Engine + Docker Compose v2 (`docker compose`)
- PostgreSQL 15+ with pgvector extension
- Redis 7+

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd psscript

# Start all services with Docker
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build

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
docker compose -f docker-compose.prod.yml up -d --build

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
- **Admin Data Maintenance** - Backup/restore + test-data cleanup workflows

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
| [docs/DOCKER-SETUP.md](./docs/DOCKER-SETUP.md) | Docker install + setup guide |
| [docs/DATA-MAINTENANCE.md](./docs/DATA-MAINTENANCE.md) | Admin backup, restore, and cleanup procedures |

## Commands Reference

### Development

```bash
# Start all services
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build

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
- `POST /api/chat` - Chat with AI assistant
- `GET /api/chat/search` - Search chat history
- `POST /api/chat/message` - Legacy-compatible message endpoint
- `POST /scripts/please` - Script generation and Q&A compatibility endpoint

### Data Maintenance
- `GET /api/admin/db/backups` - List available backup files
- `POST /api/admin/db/backup` - Create JSON backup
- `POST /api/admin/db/restore` - Restore from backup
- `POST /api/admin/db/clear-test-data` - Clear test-data tables (admin only, confirmation required)

### Maintenance Operations

- `node scripts/db-maintenance-stress-test.mjs --cycles 10` - Run repeated backup/restore/clear validation (requires running backend)
  - use `--smoke-only` to validate endpoints before repeating cycles
  - use `--no-smoke` to skip preflight checks
  - use `--restore-after-clear` to restore from the cycle backup after each clear
  - use `--insecure-tls` for local self-signed HTTPS endpoints
  - `npm run stress:data-maintenance:smoke` for a smoke-only run
  - `npm run stress:data-maintenance:smoke:restore` for smoke + restore validation
  - `npm run verify:data-maintenance:e2e` for full build/start/verify/cleanup automation
- `npm run test:voice:1-8:local` - Run automated voice tests 1-8 against local HTTPS backend (`https://127.0.0.1:4000`) with self-signed TLS accepted
- `npm run test:voice:1-8` - Run automated voice tests 1-8 against `VOICE_TEST_BASE_URL` or default base URL
- `npm run test:voice:1-8:report` - Run tests and generate artifacts:
  - JSON: `/tmp/voice-tests-1-8-latest.json`
  - Markdown: `docs/VOICE-TESTS-1-8-LATEST.md`
- `scripts/testing/test-voice-api.sh` - Legacy compatibility wrapper that delegates to the canonical `scripts/voice-tests-1-8.mjs`

## Documentation (Canonical)

Use these as source-of-truth docs:

- `docs/README-VOICE-API.md` - Voice setup, API behavior, and validation
- `docs/VOICE-API-ARCHITECTURE.md` - Current voice system architecture
- `docs/VOICE-API-INTEGRATION-SUMMARY.md` - Current integration status
- `docs/VOICE-API-NEXT-STEPS.md` - Active roadmap
- `docs/VOICE-TESTS-1-8-LATEST.md` - Latest automated voice validation report
- `docs/SUPPORT.md` - Operational support and escalation runbooks

Note: files with ` (1)` suffix and `docs/exports/html/*` are historical/export artifacts and may lag behind canonical markdown docs.

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
**Last Updated:** February 14, 2026
