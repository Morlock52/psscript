# PSScript

PowerShell Script Management with AI-assisted analysis, generation, and collaboration.

**Status:** Active Development  
**Last Updated:** 2026-02-17

## Project state snapshot

- Frontend: React + Vite SPA with dynamic AI model discovery and streaming chat
- Backend: Express/TypeScript API with multi-service routing, caching, and security middleware
- AI service: FastAPI/Python LangGraph agent layer
- Data: PostgreSQL + pgvector and Redis
- Current focus: stable local model selection experience (OpenAI/Anthropic/Google/Ollama) and resilient API-linking via runtime URL detection

## Architecture

| Service | Technology | Local/Dev Port | Compose Ports |
| --- | --- | --- | --- |
| Frontend | React 18 + Vite | 3090 | 3090 (dev) / 3002 (prod) |
| Backend | Express + TypeScript | 4001 (`PORT` default) / 4000 in compose | 4000 |
| AI Service | FastAPI + Python | 8000 | 8000 |
| PostgreSQL | PostgreSQL 15 + pgvector | 5432 | 5432 |
| Redis | Redis 7+ | 6379 | 6379 |

## What is implemented now

- Script management with upload, history, versioning, comments, and favorites
- AI features:
  - Script analysis and security review
  - AI Assistant chat
  - LangGraph-assisted workflows and streaming responses
- AI model provider stack (settings + assistant path):
  - OpenAI and Anthropic API keys
  - Google Gemini key with generateContent-capable filtering
  - Ollama local base URL/model with scan + availability checks
  - In the AI Assistant selector, chat-capable models are grouped first; analysis-only models are shown with usage caveats
- Documentation page and app UI have recent frontend polish updates (animations, spacing, charts, image sections)
- Runtime link reliability hardening:
  - API URLs are runtime-resolved in-browser
  - Same-origin `/api` fallback is used to keep LAN hosts working (`192.168.x.x`, `localhost`, etc.)
  - Ollama and provider model scan flows have multi-path fallback logic

## Quick start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker + Docker Compose
- PostgreSQL 15+
- Redis 7+

### Install and run everything (recommended)

```bash
git clone <repository-url>
cd psscript
npm run install:all
npm run dev
```

Open: `http://localhost:3090`

### Run services individually

```bash
# Backend
cd src/backend
npm install
npm run dev

# Frontend
cd src/frontend
npm install
npm run dev

# AI service
cd src/ai
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Run with containers

```bash
# Development stack (frontend/backend/api/ollama/local tools)
docker-compose up -d

# Production stack
docker-compose -f docker-compose.prod.yml up -d
```

## API map (active backend routes)

- `GET /health` and `GET /api/health`
  - Also exposes:
  - `GET /api/health/provider-models/openai`
  - `GET /api/health/provider-models/google`
  - `GET /api/health/ollama`
- `POST /api/chat` – chat stream/assist APIs
- `POST /api/ai-agent/*` – assistant and analysis endpoints
- `GET /api/assistants/*` – OpenAI Assistants-style tool endpoints
- `GET /api/scripts`, `POST /api/scripts`, `POST /api/scripts/:id/analyze`, etc.
- `GET /api/auth/*`, `GET /api/analytics/*`, `GET /api/documentation/*`, and standard CRUD routes for users/categories/tags

## Project layout

```text
psscript/
├── src/
│   ├── frontend/        # React UI
│   ├── backend/         # Express API
│   └── ai/              # FastAPI/LangGraph service
├── src/db/             # DB setup + seeds
├── docker/             # Docker helper configs
├── docs/               # Reference and architecture docs
└── scripts/            # Utility scripts
```

## Common checks

```bash
# Full frontend build
npm run -C src/frontend build

# Backend build + tests
cd src/backend && npm run build && npm test

# Frontend tests
cd src/frontend && npm run test

# AI syntax check
python -m compileall src/ai/main.py src/ai/agents/agent_factory.py
```

## Helpful notes

- `VITE_API_URL` is optional. If not set, frontend uses runtime origin + `/api` and proxies to backend.
- `VITE_DOCS_URL` and provider model keys can also be set through env for deployment-specific routing.
- Demo login and local LAN troubleshooting are currently handled in frontend auth/API URL runtime logic.
- For troubleshooting around model selection, remember:
  - Google models are limited to generation-capable entries (`generateContent`) by default
  - Ollama models can be scanned from `/api/ps` and `/api/tags` and shown with capability notes

## Documentation references

- [`CLAUDE.md`](./CLAUDE.md)
- [`docs/README-GITHUB.md`](./docs/README-GITHUB.md)
- [`docs/README-VECTOR-SEARCH.md`](./docs/README-VECTOR-SEARCH.md)
- [`docs/DOCKER-SETUP.md`](./docs/DOCKER-SETUP.md)

## License

Project metadata currently advertises MIT in package files; verify `LICENSE`/`package.json` at release time for final legal posture.
