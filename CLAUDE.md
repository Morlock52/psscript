# CLAUDE.md

This is a wild, color-charged field guide for Claude Code in this repository. It keeps the original instructions intact, adds vivid context, and stretches the guidance into a larger, more expressive map. The goal is simple: stay precise with commands, ports, and file paths, while letting the prose be bold, bright, and clear.

## How to Read This Guide
Think of this document as a painted map with fixed constellations. The colors are playful, but the facts are not. Read the short review, follow the immutable rules, and then use the color runbook for deeper guidance when you are in motion.

- Use the Core Commands and Port Table as your literal source of truth.
- Treat the Architecture section as your mental model for boundaries.
- Use the Color Runbook when you need momentum or a troubleshooting lens.
- If anything feels uncertain, return to the Imported Core and re-sync with it.

## Review Snapshot (Quick Audit of the Core)
The repository is a multi-service PowerShell script analysis platform with agentic AI capabilities. The core services are backend (TypeScript/Express), frontend (React/Vite), AI service (Python/FastAPI), and a PostgreSQL + Redis data layer. Ports are fixed and must not change. Docker Compose can bring the stack up or down, and there is a dedicated start script for the agentic system. The backend and frontend each provide standard npm workflows, and the AI service can be started directly via Python. A Cloudflare tunnel exposes the frontend with a production build.

Key facts from the core guidance:
- Ports are fixed: 3000 (frontend), 4000 (backend), 8001 (AI), 5432 (PostgreSQL), 6379 (Redis).
- Use `./scripts/ensure-ports.sh` to check or free ports.
- `docker-compose up` and `docker-compose down` are the stack toggles.
- `./start-all-agentic.sh` starts the full agentic system.
- Backend commands live under `src/backend` and use npm.
- Frontend commands live under `src/frontend` and use npm.
- AI service starts via `cd src/ai && python main.py` on port 8001.
- Cloudflare tunnel URL and config are fixed; production frontend build is required.

## Immutable Rules (The Red Line)
These rules are bright and loud on purpose. They are the guardrails that keep every other section safe.

- Do not change any port assignments. Resolve conflicts by freeing ports, not by renumbering.
- Do not invent new commands or scripts when existing ones already cover the action.
- Do not mix the Cloudflare tunnel with the Vite dev server; use the production build.
- Do not bypass file hash deduplication, security analysis, or validation steps.
- Do not blur service boundaries; keep frontend, backend, AI service, and data layer distinct.
- If you are unsure, check the Imported Core before you act.

## Core Commands (Expanded, Still Exact)
These are the canonical commands. The lists below repeat the original guidance but add context. Every command is meant to be run from the repository root unless otherwise stated.

### Docker Development
- `docker-compose up` - Start all services (backend, frontend, AI, PostgreSQL, Redis).
- `docker-compose down` - Stop all services.
- `./start-all-agentic.sh` - Start the complete agentic system.

Use Docker when you want the full system together. Keep it simple: bring it up, confirm ports, and check logs.

### Backend (TypeScript/Node.js)
- `cd src/backend && npm run dev` - Start backend in development mode.
- `cd src/backend && npm run build` - Build TypeScript to JavaScript.
- `cd src/backend && npm test` - Run backend tests.
- `cd src/backend && npm run lint` - Lint backend code.
- `cd src/backend && npm run typecheck` - TypeScript type checking.

Use these when the backend is your focus. Keep the backend running on port 4000 and treat build, lint, and typecheck as its quality gates.

### Frontend (React/Vite)
- `cd src/frontend && npm run dev` - Start frontend development server.
- `cd src/frontend && npm run build` - Build frontend for production.
- `cd src/frontend && npm run preview` - Preview production build.

Use the Vite dev server for local work, and use the production build for tunnel access.

### AI Service (Python/FastAPI)
- `cd src/ai && python main.py` - Start AI service directly.
- AI service runs on port 8001 by default.

The AI service is a separate runtime. Start it explicitly when you need AI operations.

## Port Assignments (Fixed, Bright, and Untouchable)
| Service   | Port | Notes                                    |
|-----------|------|------------------------------------------|
| Frontend  | 3000 | React app (prod build for tunnel access) |
| Backend   | 4000 | Express API server                       |
| AI Service| 8001 | FastAPI Python service                   |
| PostgreSQL| 5432 | Database                                 |
| Redis     | 6379 | Cache                                    |

Important: If port conflicts occur, kill the conflicting process; never change ports.
- Use `./scripts/ensure-ports.sh status` to check port usage.
- Use `./scripts/ensure-ports.sh kill-frontend` or `kill-backend` to free ports.

## Cloudflare Tunnel Access (Gold Thread)
- URL: `https://psscript.morloksmaze.com`
- Config: `~/.cloudflared/psscript-config.yml`
- For tunnel access, run production build: `./scripts/start-frontend-prod.sh`
- Vite dev server does NOT work through tunnel (WebSocket/HMR issues).

Treat the tunnel as a separate lane. When you are in tunnel mode, stay in production build mode.

## Architecture Overview (Four Engines, One Road)
This system is a multi-service PowerShell script analysis platform with agentic AI capabilities. The boundary lines are crisp:

1. Backend (`src/backend/`) - TypeScript/Express API server.
2. Frontend (`src/frontend/`) - React/Vite web application.
3. AI Service (`src/ai/`) - Python/FastAPI service for AI operations.
4. Data Layer - PostgreSQL with Redis for caching.

Each service has a clear job. The backend orchestrates requests and results. The frontend presents the workflow. The AI service performs model-backed analysis. The data layer stores scripts, results, and cache.

## Key Backend Components (Landmarks)
Agentic System (`src/backend/src/services/agentic/`):
- `RunEngine.ts` orchestrates multi-step AI workflows and tool execution.
- `tools/` holds modular AI tools for script analysis.
- `ScriptGenerator.ts` generates PowerShell scripts.
- `SecurityAnalyzer.ts` performs security analysis.

Controllers:
- `ScriptController.ts` is the main API for script operations and analysis.
- `AsyncUploadController.ts` handles file uploads with progress tracking.

Database Integration:
- `connection.ts` centralizes database connection management.
- `models/index.ts` defines Sequelize models and relationships.
- File hash deduplication prevents duplicate script storage.

## AI Service Architecture (Clear Channel)
- `main.py` runs the FastAPI server with multiple AI endpoints.
- `voice_endpoints.py` provides voice interaction capabilities.
- Vector database integration supports semantic search.
- Multiple AI models and providers are supported.

Treat the AI service as its own world. Keep its port fixed and let the backend communicate with it across the boundary.

## Data Flow (Pipeline with Teeth)
1. Scripts uploaded via frontend -> `AsyncUploadController`.
2. File hash checked for deduplication -> Database storage.
3. Analysis requests -> `RunEngine` -> AI tools -> Results.
4. Vector embeddings stored for semantic search.
5. Real-time updates via WebSocket connections.

The data flow is the backbone. Keep it intact, and every other system becomes easier to reason about.

## Development Notes (Practical, Not Mystical)
- Scripts are stored with file hash deduplication.
- Analysis results are cached in Redis.
- Vector embeddings provide semantic search.
- JWT-based authentication protects access.
- Security analysis is integrated into workflows.

These notes are a reminder of the platform DNA: security, deduplication, and AI-driven analysis.

## Testing and Verification (Keep It Honest)
- Backend tests focus on API endpoints and agentic tools.
- Use the existing test commands in each package.json.
- Integration tests cover database operations and AI workflows.

Treat tests as the calm voice in a loud room. If you are moving fast, test even faster.

## Troubleshooting (Short Loops, Clear Eyes)
When something goes sideways, return to fundamentals: ports, commands, boundaries.

- Check port usage with `./scripts/ensure-ports.sh status`.
- Free ports with `./scripts/ensure-ports.sh kill-frontend` or `kill-backend`.
- Verify which services are running and what they are bound to.
- Do not change ports; fix the conflict.
- If the tunnel is in use, confirm you are running a production frontend build.
- Keep a minimal, written timeline of what you tried.

## Workspace Map (High-Level)
This is a rough map of the top-level landscape, intended to help you navigate without guessing.

- `src/backend` - Backend service source and tooling.
- `src/frontend` - Frontend UI and build tooling.
- `src/ai` - AI service runtime and endpoints.
- `scripts` - Operational scripts, including port helpers.
- `docker` and `docker-compose*.yml` - Container configuration.
- `docs` - Additional documentation and references.
- `tests` - Test suites and supporting fixtures.
- `assets`, `logs`, `backups` - Supporting assets, runtime logs, and backups.
- `product-website`, `nginx` - Auxiliary web and routing config.

If you are uncertain where to work, start from `src/` and follow the service boundary.

## Color Runbook (Wild and Color, Still Precise)

### Crimson Signal: ports and conflict resolution
Crimson is the electric banner for ports and conflict resolution. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Crimson mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Crimson is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Ports are fixed: 3000, 4000, 8001, 5432, 6379.
- Use ./scripts/ensure-ports.sh status and kill-frontend/kill-backend.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Amber Axis: startup order and orchestration
Amber is the sun-bright banner for startup order and orchestration. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Amber mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Amber is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- docker-compose up and docker-compose down are the stack toggles.
- ./start-all-agentic.sh starts the complete agentic system.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Gold Ritual: tunnel access and production preview
Gold is the storm-blue banner for tunnel access and production preview. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Gold mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Gold is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Cloudflare URL: https://psscript.morloksmaze.com.
- Use ./scripts/start-frontend-prod.sh for tunnel access.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Saffron Chapter: builds and release posture
Saffron is the ember-hot banner for builds and release posture. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Saffron mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Saffron is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Backend build: cd src/backend && npm run build.
- Frontend build: cd src/frontend && npm run build.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Lime Compass: frontend development flow
Lime is the mint-cool banner for frontend development flow. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Lime mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Lime is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Frontend dev server: cd src/frontend && npm run dev.
- Preview build: cd src/frontend && npm run preview.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Chartreuse Beacon: frontend guardrails and tunnel rules
Chartreuse is the glass-clear banner for frontend guardrails and tunnel rules. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Chartreuse mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Chartreuse is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Vite dev server does not work through the tunnel.
- Use production build for tunnel access.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Azure Pulse: backend development flow
Azure is the ink-dark banner for backend development flow. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Azure mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Azure is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Backend dev: cd src/backend && npm run dev.
- Backend tests: cd src/backend && npm test.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Cobalt Field: backend quality gates
Cobalt is the sky-wide banner for backend quality gates. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Cobalt mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Cobalt is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Lint: cd src/backend && npm run lint.
- Typecheck: cd src/backend && npm run typecheck.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Indigo Mode: agentic system core
Indigo is the ocean-deep banner for agentic system core. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Indigo mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Indigo is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- RunEngine.ts orchestrates multi-step AI workflows.
- tools/ includes ScriptGenerator.ts and SecurityAnalyzer.ts.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Violet Key: agentic tool boundaries
Violet is the steel-bright banner for agentic tool boundaries. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Violet mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Violet is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Agentic tools live under src/backend/src/services/agentic/tools/.
- Keep tool roles distinct and well described.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Magenta Signal: authentication and security posture
Magenta is the flame-quick banner for authentication and security posture. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Magenta mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Magenta is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- JWT-based authentication is in place.
- Security analysis is integrated into workflows.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Fuchsia Axis: security analysis workflow
Fuchsia is the quiet-bold banner for security analysis workflow. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Fuchsia mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Fuchsia is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- SecurityAnalyzer.ts performs security analysis.
- File hash validation prevents malicious uploads.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Teal Ritual: AI service runtime
Teal is the electric banner for AI service runtime. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Teal mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Teal is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- AI service start: cd src/ai && python main.py.
- AI service runs on port 8001.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Cyan Chapter: vector search and embeddings
Cyan is the sun-bright banner for vector search and embeddings. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Cyan mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Cyan is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Vector embeddings are stored for semantic search.
- AI service integrates with a vector database.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Emerald Compass: database and cache
Emerald is the storm-blue banner for database and cache. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Emerald mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Emerald is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- PostgreSQL runs on port 5432.
- Redis cache runs on port 6379.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Green Beacon: file hash deduplication
Green is the ember-hot banner for file hash deduplication. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Green mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Green is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- File hash deduplication prevents duplicate script storage.
- File hash checks occur before storage.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Copper Pulse: upload pipeline
Copper is the mint-cool banner for upload pipeline. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Copper mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Copper is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- AsyncUploadController.ts handles file uploads.
- Uploads include progress tracking and dedup checks.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Bronze Field: database models and connections
Bronze is the glass-clear banner for database models and connections. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Bronze mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Bronze is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- connection.ts centralizes DB connection management.
- models/index.ts defines Sequelize models and relationships.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Silver Mode: observability and calm logs
Silver is the ink-dark banner for observability and calm logs. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Silver mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Silver is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Check logs and service health before making changes.
- Prefer small, reversible steps during debugging.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Slate Key: testing and verification
Slate is the sky-wide banner for testing and verification. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Slate mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Slate is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Use existing test commands in package.json files.
- Integration tests cover DB operations and AI workflows.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Obsidian Signal: failure recovery
Obsidian is the ocean-deep banner for failure recovery. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Obsidian mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Obsidian is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Kill conflicting processes instead of changing ports.
- Return to core commands when systems drift.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Ivory Axis: documentation hygiene
Ivory is the steel-bright banner for documentation hygiene. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Ivory mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Ivory is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Update this guide when commands or ports change.
- Keep the Imported Core aligned with reality.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Pearl Ritual: consistency and conventions
Pearl is the flame-quick banner for consistency and conventions. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Pearl mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Pearl is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Keep service boundaries crisp and documented.
- Use the canonical command lists, not guesses.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Rose Chapter: collaboration and handoff
Rose is the quiet-bold banner for collaboration and handoff. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Rose mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Rose is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- State which service you touched and why.
- Record commands run and their intent.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Coral Compass: real-time updates and UX flow
Coral is the electric banner for real-time updates and UX flow. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Coral mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Coral is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Real-time updates are delivered via WebSocket connections.
- Frontend presents the analysis workflow to users.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Mint Beacon: clean shutdown and reset
Mint is the sun-bright banner for clean shutdown and reset. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Mint mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Mint is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- docker-compose down stops all services.
- Use stop commands to keep ports clean.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Smoke Pulse: debug loops and port checks
Smoke is the storm-blue banner for debug loops and port checks. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Smoke mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Smoke is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Start with ensure-ports.sh before deeper debugging.
- Ports are fixed; conflicts must be resolved, not bypassed.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Frost Field: environment sanity
Frost is the ember-hot banner for environment sanity. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Frost mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Frost is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Keep dependencies aligned with each service package.json.
- Avoid mixing dev and prod modes in the same session.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Dawn Mode: onboarding and first runs
Dawn is the mint-cool banner for onboarding and first runs. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Dawn mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Dawn is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- docker-compose up brings the full stack online.
- Start with the core commands before custom workflows.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Dusk Key: end of day closure
Dusk is the glass-clear banner for end of day closure. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Dusk mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Dusk is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- docker-compose down is the clean exit for the stack.
- Write a short summary of changes and open questions.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Neon Signal: safe experimentation
Neon is the ink-dark banner for safe experimentation. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Neon mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Neon is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Use the agentic system with clear, bounded tasks.
- Document assumptions before running multi-step workflows.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

### Stone Axis: stability and performance
Stone is the sky-wide banner for stability and performance. It is the reminder that we can be bold in language but exact in execution. Use this color to name the work, mark the boundary, and keep the core commands within arm's reach. Every move you make should point back to the fixed facts.
In Stone mode, prefer short, sharp loops: observe, act, verify, and write a single-line note. Do not invent new paths or scripts; the existing commands are the rails. If the work feels wide, shrink it until you can say exactly which service you are touching and which port it speaks on.
Signals that the color is working: the right service is on the right port, the frontend, backend, AI service, and data layer stay in their lanes, and the logs are quiet. If any of those drift, pause and re-anchor to the core.
Wild note: Stone is not chaos, it is controlled brightness. Use it to keep the work vivid, but let the facts drive the steering.
Anchors:
- Prefer small changes and verify with tests.
- Keep the data flow intact to avoid regressions.
Rituals:
- State the service and port before you touch anything.
- Pick one command from the core list and run only that.
- Write a one-line intent in plain words before action.
- Confirm boundaries: frontend, backend, AI service, data layer.
- Keep a tiny log of what changed and why.
- Stop if you are tempted to change a port.
Avoid:
- Do not invent new scripts or rename existing ones.
- Do not move ports, even if it feels faster.
- Do not mix the tunnel with the Vite dev server.
- Do not assume a model or provider without checking.
- Do not skip dedup or hash checks.
- Do not let one service silently own another.
Micro-checklist:
- Ports match the table and are free.
- Commands used match the doc exactly.
- Services start in expected order and stay stable.
- Logs are calm, repeatable, and boring.
- Data flow steps are intact and visible.
- Next action is stated in one clear sentence.

## Glossary (Quick Definitions, Bright Ink)
- Agentic system: The workflow engine and tools that coordinate multi-step AI analysis.
- Backend: The TypeScript/Express service at `src/backend`.
- Frontend: The React/Vite web UI at `src/frontend`.
- AI service: The Python/FastAPI service at `src/ai` on port 8001.
- RunEngine: Orchestrator for multi-step AI workflows in `RunEngine.ts`.
- Tool: A modular AI unit under `src/backend/src/services/agentic/tools`.
- ScriptGenerator: Tool that generates PowerShell scripts.
- SecurityAnalyzer: Tool that performs security analysis.
- File hash deduplication: A safeguard that prevents duplicate script storage.
- Vector embeddings: Numerical representations stored for semantic search.
- Redis cache: In-memory cache on port 6379 for fast lookups.
- PostgreSQL: Primary database on port 5432.
- WebSocket updates: Real-time updates delivered to the frontend.
- Tunnel: Cloudflare path to the frontend at https://psscript.morloksmaze.com.
- Production build: The frontend build used for tunnel access.
- Dev server: Vite server used for local frontend development.
- Port table: The fixed list of service ports that must not change.
- Core commands: Canonical commands for starting and managing services.
- Async upload: Upload process handled by `AsyncUploadController.ts`.
- Data flow: The end-to-end pipeline from upload to analysis to results.
- Boundary: The clean separation between services and responsibilities.

## FAQ (Short, Direct, Bright)
Q: Can I change a port if something is already using it?
A: No. Free the port using the ensure-ports script or stop the conflicting process.

Q: Can I use the Vite dev server through the Cloudflare tunnel?
A: No. Use the production build and the provided start script.

Q: Where do I start if I want the full system running?
A: `docker-compose up` is the standard full-stack entry.

Q: What is the fastest way to start the full agentic workflow?
A: `./start-all-agentic.sh` is the dedicated entry for that.

Q: If I only need backend work, what do I run?
A: Use the backend npm scripts from `src/backend`.

Q: How do I start the AI service on its own?
A: `cd src/ai && python main.py` starts it on port 8001.

Q: Where does security analysis happen?
A: In the backend agentic tools, including `SecurityAnalyzer.ts`.

Q: What keeps duplicate scripts out of storage?
A: File hash deduplication and validation.

Q: How do I know the data flow is intact?
A: Confirm the upload -> dedup -> analysis -> embeddings -> WebSocket path.

Q: What should I do if something feels uncertain?
A: Return to the Imported Core and re-align with the fixed facts.

## Neon Playbooks (Run Cards, Loud but Accurate)
These are short, action-focused playbooks. Each one is vivid, but every step is anchored to commands or facts already defined.

### Playbook: Cold Start, Full Stack
- Goal: bring the entire system online with minimal drift.
- Run: `docker-compose up`.
- Verify: ports match the fixed table.
- Confirm: backend, frontend, AI service, database, cache are all responsive.
- If conflict: use `./scripts/ensure-ports.sh status`, then free the port without renumbering.

### Playbook: Agentic Sprint
- Goal: run the agentic workflow with the full stack in place.
- Run: `./start-all-agentic.sh`.
- Verify: the AI service is on port 8001 and the backend is on 4000.
- Confirm: RunEngine and tools are responding to requests.
- If uncertain: return to Core Commands and re-align.

### Playbook: Backend-Only Focus
- Goal: iterate on backend logic without touching frontend.
- Run: `cd src/backend && npm run dev`.
- Optional checks: `npm run lint`, `npm run typecheck`, `npm test`.
- Verify: backend stays on port 4000.
- Keep notes: which controller or service you touched.

### Playbook: Frontend-Only Focus
- Goal: iterate on UI without altering backend.
- Run: `cd src/frontend && npm run dev`.
- Verify: frontend stays on port 3000.
- If using the tunnel: stop dev server and use production build.

### Playbook: Tunnel Mode
- Goal: serve the frontend through Cloudflare tunnel.
- Run: `./scripts/start-frontend-prod.sh`.
- Confirm: production build is live on https://psscript.morloksmaze.com.
- Rule: do not run Vite dev server through the tunnel.

### Playbook: AI Service Solo
- Goal: run and test AI service directly.
- Run: `cd src/ai && python main.py`.
- Verify: the AI service stays on port 8001.
- Confirm: endpoints respond as expected.

### Playbook: Port Conflict Rescue
- Goal: resolve port collisions without changing port assignments.
- Run: `./scripts/ensure-ports.sh status`.
- If conflict: `./scripts/ensure-ports.sh kill-frontend` or `kill-backend`.
- Re-run the service with its original command.
- Verify: port table is intact.

### Playbook: Upload Pipeline Trace
- Goal: confirm the upload -> dedup -> analysis -> results flow.
- Trigger upload via the frontend.
- Confirm: AsyncUploadController handles the request.
- Verify: file hash dedup executes before storage.
- Confirm: RunEngine performs analysis and results return.

### Playbook: Security Pass
- Goal: ensure security analysis remains in the workflow.
- Confirm: SecurityAnalyzer is invoked for analysis tasks.
- Verify: file hash validation is active.
- Do not bypass any security checks.

### Playbook: Vector Search Sanity
- Goal: validate semantic search storage and retrieval.
- Confirm: vector embeddings are written after analysis.
- Verify: query uses the vector database path.
- Keep the AI service running on port 8001.

### Playbook: Calm Shutdown
- Goal: stop services cleanly and free ports.
- Run: `docker-compose down`.
- Verify: ports are free and no service is lingering.

## Signal Cards (One-Liners You Can Hold)
- Crimson Signal: port conflict detected -> use ensure-ports and free, never renumber.
- Amber Signal: system start needed -> use docker-compose up or start-all-agentic.
- Gold Signal: tunnel required -> production build only.
- Azure Signal: backend focus -> cd src/backend and run dev.
- Lime Signal: frontend focus -> cd src/frontend and run dev.
- Teal Signal: AI service focus -> cd src/ai and run python main.py.
- Slate Signal: quality check -> lint, typecheck, test as needed.
- Obsidian Signal: drift detected -> return to core commands and ports.

## Flow Sketches (ASCII, Quick Map)
Upload Pipeline:
- Frontend -> AsyncUploadController -> file hash dedup -> database storage -> RunEngine -> AI tools -> results -> WebSocket updates.

Analysis Loop:
- Request -> RunEngine -> Tool selection -> AI service -> results -> cache -> frontend display.

Tunnel Flow:
- Build frontend -> start production server -> Cloudflare tunnel -> user access.

## Service Contract Cards (Keep the Boundaries Bright)
Frontend:
- Owns UI, user flows, and visualization.
- Talks to backend on port 4000.
- Runs on port 3000.

Backend:
- Owns API, orchestration, and the agentic system.
- Talks to AI service on port 8001.
- Talks to database and cache.
- Runs on port 4000.

AI Service:
- Owns model-backed analysis and vector operations.
- Runs on port 8001.
- Exposes FastAPI endpoints.

Database and Cache:
- PostgreSQL on port 5432.
- Redis on port 6379.
- Store scripts, results, and cached data.

## Debug Ladder (Short, Bright Steps)
- Step 1: Check port table and resolve conflicts.
- Step 2: Confirm each service is running with its canonical command.
- Step 3: Verify boundaries: frontend only UI, backend only API, AI only model work.
- Step 4: Validate data flow from upload to results.
- Step 5: Run tests appropriate to the service.
- Step 6: Write a one-line summary of what changed.

## Command Palette (Verbs to Actions)
- Start everything -> `docker-compose up`.
- Stop everything -> `docker-compose down`.
- Start agentic system -> `./start-all-agentic.sh`.
- Start backend -> `cd src/backend && npm run dev`.
- Build backend -> `cd src/backend && npm run build`.
- Lint backend -> `cd src/backend && npm run lint`.
- Typecheck backend -> `cd src/backend && npm run typecheck`.
- Test backend -> `cd src/backend && npm test`.
- Start frontend -> `cd src/frontend && npm run dev`.
- Build frontend -> `cd src/frontend && npm run build`.
- Preview frontend -> `cd src/frontend && npm run preview`.
- Start AI service -> `cd src/ai && python main.py`.
- Check ports -> `./scripts/ensure-ports.sh status`.
- Kill frontend port -> `./scripts/ensure-ports.sh kill-frontend`.
- Kill backend port -> `./scripts/ensure-ports.sh kill-backend`.
- Tunnel mode -> `./scripts/start-frontend-prod.sh`.

## Color Storm Table (What to Do When the Room Glows)
- Red storm: port conflict -> free the port, keep the table intact.
- Yellow storm: startup confusion -> use the canonical start command.
- Blue storm: backend is down -> start backend and confirm port 4000.
- Green storm: frontend is down -> start frontend and confirm port 3000.
- Teal storm: AI errors -> restart AI service on port 8001.
- Silver storm: tests failing -> rerun tests after confirming ports.
- Black storm: multiple failures -> stop everything, reset, and start clean.

## Handoff Ritual (Small, Fast, Human)
- Say which service you touched.
- Say which command you ran.
- Say which port you verified.
- Say which file or module you changed.
- Say what still feels uncertain.

## Change Discipline (Wild Style, Tight Control)
- Keep changes scoped to one service at a time.
- Do not mix tunnel mode with dev server mode.
- Record the command you ran to start a service.
- Prefer reversible steps and verify each one.
- If unsure, stop and re-anchor to the core.

## Practice Drills (Use to Stay Sharp)
- Drill 1: Start the backend and confirm port 4000.
- Drill 2: Start the frontend and confirm port 3000.
- Drill 3: Start AI service and confirm port 8001.
- Drill 4: Run an upload and confirm dedup.
- Drill 5: Run analysis and confirm results arrive.

## Extended Notes on the Agentic System
- RunEngine is the coordinator; treat it as the source of workflow truth.
- Tools should be modular and clearly described.
- SecurityAnalyzer stays in the loop for safety checks.
- ScriptGenerator provides creation functionality, not execution.
- Tool boundaries should stay stable to avoid hidden coupling.

## Vector and Cache Discipline
- Vector embeddings are written after analysis.
- Cache is for speed, not truth. The database remains the source of record.
- Keep the vector database connected to the AI service boundary.

## Port Discipline (Reinforced)
- The port table is a contract, not a suggestion.
- If a port is in use, free it. Do not change the assignment.
- Keep the ensure-ports script close.

## Closing Tone (Bright, Calm, Precise)
This guide can be colorful without becoming chaotic. The commands, ports, and boundaries remain exact. The vivid language is a reminder to stay aware, move clearly, and keep the system stable.

## Imported Core (Verbatim Reference, Reviewed and Preserved)
The block below is the original CLAUDE.md content, preserved as a stable reference.

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

### Port Assignments (DO NOT CHANGE)
| Service   | Port | Notes                                    |
|-----------|------|------------------------------------------|
| Frontend  | 3000 | React app (prod build for tunnel access) |
| Backend   | 4000 | Express API server                       |
| AI Service| 8001 | FastAPI Python service                   |
| PostgreSQL| 5432 | Database                                 |
| Redis     | 6379 | Cache                                    |

**Important**: If port conflicts occur, kill the conflicting process - never change ports.
- Use `./scripts/ensure-ports.sh status` to check port usage
- Use `./scripts/ensure-ports.sh kill-frontend` or `kill-backend` to free ports

### Cloudflare Tunnel Access
- URL: `https://psscript.morloksmaze.com`
- Config: `~/.cloudflared/psscript-config.yml`
- For tunnel access, run production build: `./scripts/start-frontend-prod.sh`
- Vite dev server does NOT work through tunnel (WebSocket/HMR issues)

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
