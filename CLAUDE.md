# CLAUDE.md

PowerShell script analysis platform with agentic AI. Four services: backend (TypeScript/Express), frontend (React/Vite), AI service (Python/FastAPI), PostgreSQL + Redis.

## Immutable Rules
- **Never change ports** - resolve conflicts by freeing ports, not renumbering
- **Never mix tunnel with Vite dev server** - use production build for tunnel
- **Never bypass security** - file hash deduplication, security analysis, validation steps
- **Keep service boundaries crisp** - frontend, backend, AI service, data layer stay distinct
- **Use existing commands** - don't invent new scripts when canonical ones exist

## Port Assignments (FIXED)
| Service    | Port | Command                                  |
|------------|------|------------------------------------------|
| Frontend   | 3000 | `cd src/frontend && npm run dev`         |
| Backend    | 4000 | `cd src/backend && npm run dev`          |
| AI Service | 8000 | `cd src/ai && python main.py`            |
| PostgreSQL | 5432 | via docker-compose                       |
| Redis      | 6379 | via docker-compose                       |

**Port conflicts:** `./scripts/ensure-ports.sh status` | `kill-frontend` | `kill-backend`

---

## Commands

### Docker (Full Stack)
| Command | Purpose | When to Use |
|---------|---------|-------------|
| `docker-compose up` | Start all services | Full system needed, first-time setup |
| `docker-compose down` | Stop all services | Clean shutdown, free all ports |
| `./start-all-agentic.sh` | Start agentic system | AI workflow development |

### Backend (`src/backend/`)
| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run dev` | Development mode (port 4000) | Active backend development |
| `npm run build` | Compile TypeScript to JS | Before deployment, after TS changes |
| `npm test` | Run test suite | After changes, before commits |
| `npm run lint` | Check code style | Before commits, CI pipeline |
| `npm run typecheck` | Validate TypeScript types | After interface changes |

### Frontend (`src/frontend/`)
| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run dev` | Dev server (port 3000) | Local UI development only |
| `npm run build` | Production bundle | Before tunnel access, deployment |
| `npm run preview` | Serve production build locally | Test prod build before deploy |

### Cloudflare Tunnel
| Item | Value |
|------|-------|
| URL | `https://psscript.morloksmaze.com` |
| Config | `~/.cloudflared/psscript-config.yml` |
| Start command | `./scripts/start-frontend-prod.sh` |

**Critical:** Vite dev server does NOT work through tunnel (WebSocket/HMR incompatible). Always use production build.

---

## Architecture

### Service Topology
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│   AI Service    │
│   React/Vite    │     │ Express/Node.js │     │ Python/FastAPI  │
│    Port 3000    │     │    Port 4000    │     │    Port 8000    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌───────────────┐         ┌───────────────┐
           │  PostgreSQL   │         │     Redis     │
           │   Port 5432   │         │   Port 6379   │
           │  (persistent) │         │    (cache)    │
           └───────────────┘         └───────────────┘
```

### Service Boundaries
| Service | Owns | Talks To | Never Does |
|---------|------|----------|------------|
| **Frontend** | UI, user flows, visualization | Backend API (4000) | Direct DB access, AI calls |
| **Backend** | API, orchestration, agentic system | AI service, PostgreSQL, Redis | UI rendering |
| **AI Service** | Model inference, vector ops, embeddings | Vector database | Direct user interaction |
| **PostgreSQL** | Persistent data, scripts, results | Backend only | - |
| **Redis** | Cache, session data, temp results | Backend only | Persistent storage |

### Key Components

#### Backend (`src/backend/`)
| Path | Component | Responsibility |
|------|-----------|----------------|
| `src/services/agentic/RunEngine.ts` | RunEngine | Orchestrates multi-step AI workflows, tool selection, execution sequencing |
| `src/services/agentic/tools/` | Tool modules | Modular AI capabilities (ScriptGenerator, SecurityAnalyzer, etc.) |
| `src/services/agentic/tools/ScriptGenerator.ts` | ScriptGenerator | Generates PowerShell scripts from requirements |
| `src/services/agentic/tools/SecurityAnalyzer.ts` | SecurityAnalyzer | Analyzes scripts for security vulnerabilities |
| `src/controllers/ScriptController.ts` | ScriptController | Main API for script CRUD and analysis triggers |
| `src/controllers/AsyncUploadController.ts` | AsyncUploadController | Chunked uploads, progress tracking, dedup checks |
| `src/database/connection.ts` | DB Connection | Centralized Sequelize connection management |
| `src/database/models/index.ts` | Models | Sequelize models: Script, AnalysisResult, User, etc. |

#### AI Service (`src/ai/`)
| Path | Component | Responsibility |
|------|-----------|----------------|
| `main.py` | FastAPI server | AI endpoints, model routing, provider abstraction |
| `voice_endpoints.py` | Voice API | Speech-to-text, text-to-speech interactions |
| Vector DB integration | Embeddings | Semantic search, similarity queries |

---

## Agentic System

### How It Works
```
User Request
     │
     ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ RunEngine   │────▶│ Tool Select │────▶│ Tool Exec   │
│ (orchestr.) │     │ (matching)  │     │ (action)    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
     ┌─────────────────────────────────────────┘
     ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ AI Service  │────▶│ Results     │────▶│ WebSocket   │
│ (inference) │     │ (stored)    │     │ (real-time) │
└─────────────┘     └─────────────┘     └─────────────┘
```

### RunEngine (`RunEngine.ts`)
- **Role:** Central orchestrator for multi-step AI workflows
- **Inputs:** User request, context, available tools
- **Process:** Analyzes request → selects tools → sequences execution → aggregates results
- **Outputs:** Structured results, status updates via WebSocket

### Available Tools (`src/backend/src/services/agentic/tools/`)
| Tool | Input | Output | Use Case |
|------|-------|--------|----------|
| ScriptGenerator | Requirements, context | PowerShell script | Creating new scripts |
| SecurityAnalyzer | Script content | Vulnerability report | Security audits |
| Additional tools | Varies | Varies | Specialized analysis |

### Tool Design Principles
- Each tool has a single, well-defined responsibility
- Tools are stateless - all context passed in, no side effects
- Tools communicate through RunEngine, never directly
- New tools extend capability without modifying orchestration

---

## Data Flow

### Upload Pipeline
```
1. Frontend: User selects file(s)
         │
         ▼
2. AsyncUploadController: Receives chunks, tracks progress
         │
         ▼
3. Hash Check: Compute SHA-256 of content
         │
         ├──▶ Hash exists? Return existing script (dedup)
         │
         ▼
4. Database: Store script with hash, metadata
         │
         ▼
5. Response: Return script ID, ready for analysis
```

### Analysis Pipeline
```
1. API Request: POST /api/scripts/:id/analyze
         │
         ▼
2. ScriptController: Validate request, load script
         │
         ▼
3. RunEngine: Determine required tools
         │
         ▼
4. Tool Execution: SecurityAnalyzer, etc.
         │
         ▼
5. AI Service: Model inference (port 8000)
         │
         ▼
6. Results: Store in PostgreSQL, cache in Redis
         │
         ▼
7. Vector Embeddings: Store for semantic search
         │
         ▼
8. WebSocket: Push real-time updates to frontend
```

### Deduplication Logic
- **When:** Every upload, before storage
- **How:** SHA-256 hash of script content
- **Match found:** Return existing script ID (no duplicate storage)
- **No match:** Store new script with computed hash
- **Why:** Prevents storage bloat, enables instant retrieval of known scripts

### Caching Strategy
| Data | Storage | TTL | Purpose |
|------|---------|-----|---------|
| Analysis results | Redis | Configurable | Fast retrieval of recent analyses |
| Session data | Redis | Session length | User state |
| Scripts | PostgreSQL | Permanent | Source of truth |
| Embeddings | Vector DB | Permanent | Semantic search |

---

## Security

### Authentication
- **Method:** JWT (JSON Web Tokens)
- **Flow:** Login → JWT issued → JWT in Authorization header → Validated per request
- **Storage:** Token in client, refresh logic in frontend

### SecurityAnalyzer Tool
- **Input:** PowerShell script content
- **Checks:**
  - Known malicious patterns
  - Dangerous cmdlets (Invoke-Expression, etc.)
  - Obfuscation techniques
  - Network/file system access patterns
  - Credential handling
- **Output:** Risk score, finding details, recommendations

### File Hash Validation
- **Purpose:** Integrity + deduplication
- **Algorithm:** SHA-256
- **Validates:** Content hasn't changed, prevents re-upload of identical files
- **Security benefit:** Known-bad hashes can be blocklisted

### Security Checklist
- [ ] All uploads go through AsyncUploadController (never bypass)
- [ ] Hash computed before any storage
- [ ] SecurityAnalyzer runs on analysis requests
- [ ] JWT validated on protected endpoints
- [ ] No direct database access from frontend

---

## Troubleshooting

### Debug Ladder (Follow In Order)
1. **Check ports:** `./scripts/ensure-ports.sh status`
2. **Free conflicts:** `kill-frontend` or `kill-backend` as needed
3. **Verify services:** Each on correct port, logs clean
4. **Check boundaries:** Is each service doing only its job?
5. **Validate data flow:** Upload → dedup → analysis → results working?
6. **Run tests:** `cd src/backend && npm test`
7. **Check logs:** Look for errors in service output

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Port already in use | Previous process didn't exit | `./scripts/ensure-ports.sh kill-frontend` or `kill-backend` |
| Tunnel shows blank page | Using Vite dev server | Switch to `./scripts/start-frontend-prod.sh` |
| Analysis hangs | AI service not running | Start with `cd src/ai && python main.py` |
| Duplicate script stored | Dedup bypassed | Check AsyncUploadController is handling upload |
| WebSocket not updating | Backend not emitting | Check WebSocket setup in backend logs |
| Auth failing | JWT expired/invalid | Re-login, check token refresh logic |

### Recovery Playbook
```bash
# Nuclear option: full reset
docker-compose down
./scripts/ensure-ports.sh status    # Verify all clear
docker-compose up                   # Fresh start
```

### Log Locations
- **Backend:** stdout when running `npm run dev`
- **Frontend:** Browser console + stdout from `npm run dev`
- **AI Service:** stdout from `python main.py`
- **Docker:** `docker-compose logs [service]`

---

## Quick Reference by Task

| Task | Commands/Files |
|------|----------------|
| **Start everything** | `docker-compose up` |
| **Stop everything** | `docker-compose down` |
| **Port conflicts** | `./scripts/ensure-ports.sh status`, `kill-frontend`, `kill-backend` |
| **Tunnel access** | `./scripts/start-frontend-prod.sh` (production build required) |
| **Backend dev** | `cd src/backend && npm run dev` |
| **Backend quality** | `npm run lint && npm run typecheck && npm test` |
| **Frontend dev** | `cd src/frontend && npm run dev` |
| **AI service** | `cd src/ai && python main.py` |
| **Agentic workflows** | `src/backend/src/services/agentic/RunEngine.ts` |
| **Add new tool** | Create in `src/backend/src/services/agentic/tools/` |
| **Security analysis** | `SecurityAnalyzer.ts` |
| **Upload handling** | `AsyncUploadController.ts` |
| **Database models** | `src/backend/src/database/models/index.ts` |

---

## Workspace Map
```
psscript/
├── src/
│   ├── backend/          # TypeScript/Express API (port 4000)
│   │   └── src/
│   │       ├── controllers/
│   │       ├── services/agentic/   # RunEngine + tools
│   │       ├── database/
│   │       └── ...
│   ├── frontend/         # React/Vite UI (port 3000)
│   └── ai/               # Python/FastAPI (port 8000)
├── scripts/              # Operational scripts (ensure-ports.sh, etc.)
├── docker-compose.yml    # Full stack orchestration
├── docs/                 # Additional documentation
└── tests/                # Test suites
```

---

## Universal Rituals
1. State the service and port before touching anything
2. Use only commands from this doc
3. Verify ports match the table before debugging deeper
4. Keep boundaries: frontend=UI, backend=API, AI=models, data=storage
5. Log what you changed and why
6. Run quality checks before committing: `lint`, `typecheck`, `test`

## Never Do
- Change port assignments (free conflicting processes instead)
- Mix tunnel with Vite dev server
- Bypass AsyncUploadController for uploads
- Skip hash checks or security analysis
- Let one service reach into another's domain
- Invent new scripts when canonical ones exist
