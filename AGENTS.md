# AGENTS.md

Notes for working on the agentic/AI parts of this repo.

## Services + Ports (Local)
- Frontend: `http://localhost:3090`
- Backend API: `http://localhost:4000`
- AI Service (Python/FastAPI): `http://localhost:8000`

## AI Key + Models
- The backend uses your OpenAI key from `OPENAI_API_KEY`.
- Default models (performance-leaning):
  - `OPENAI_SMART_MODEL=gpt-5.2-codex` (best agentic coding quality)
  - `OPENAI_FAST_MODEL=gpt-5-mini` (fast interactive UX)

## Agentic Endpoints (Backend)
These power the UI under `/ai/agents` (Agent Orchestration / Agent Chat).

- `POST /api/agents` → create an agent
- `POST /api/agents/threads` → create a thread for an agent
- `POST /api/agents/threads/:threadId/messages` → add a message
- `POST /api/agents/threads/:threadId/runs` → start a run (async)
- `GET /api/agents/runs/:runId` → poll run status (must NOT be cached)
- `GET /api/agents/threads/:threadId/messages` → list thread messages

## Other AI Endpoints (Backend)
- `POST /api/ai-agent/explain` (simple/detailed explanation)
- `POST /api/ai-agent/analyze/*` (script analysis variants)
- `POST /api/ai-agent/route` (model routing decision)
- `POST /api/ai-agent/execute` (simulated execution; accepts `{ content }` or `{ script }`)

## Auth (Local Dev)
- Local dev is configured to run with auth disabled:
  - Backend: `DISABLE_AUTH=true`
  - Frontend: `VITE_DISABLE_AUTH=true`

## Running (Docker)
```bash
docker compose --env-file .env up -d --build
```

## Testing (Playwright)
API tests (Dockerized runner):
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.e2e.yml run --rm e2e \
  bash -lc "npm ci && npx playwright test tests/e2e/health-checks.spec.ts tests/e2e/ai-agents.spec.ts tests/e2e/agent-orchestrator.spec.ts --project=chromium --workers=1"
```

UI tests (Dockerized runner):
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.e2e.yml run --rm -e PW_UI=true e2e \
  bash -lc "npm ci && PW_UI=true npx playwright test tests/e2e/health-checks.spec.ts tests/e2e/script-management.spec.ts tests/e2e/button_link_smoke.spec.ts --project=chromium --workers=1"
```

## Link/Button Integrity
- All UI links and buttons must be tested and must lead somewhere (including a future feature placeholder page).
- Any non-working link or button must be recorded in `docs/non-working-links.md` with page/route, label, expected destination, and date discovered.
