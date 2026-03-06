# PSScript

PowerShell script management with AI analysis, semantic search, documentation crawl tooling, and OpenAI-backed voice workflows.

![Dashboard screenshot](./docs/screenshots/dashboard.png)
![Scripts screenshot](./docs/screenshots/scripts.png)

## What this repo does

- Stores, versions, and searches PowerShell scripts
- Runs AI-assisted analysis and remediation guidance
- Crawls and indexes documentation content
- Provides admin database backup and restore tooling
- Exposes voice synthesis and speech-recognition flows through the AI service

## Canonical local stack

The checked-in local-development defaults are:

| Service | URL |
| --- | --- |
| Frontend | `https://127.0.0.1:3090` |
| Backend API | `https://127.0.0.1:4000/api` |
| AI service | `http://127.0.0.1:8000` |
| PostgreSQL | `127.0.0.1:5432` |
| Redis | `127.0.0.1:6379` |

These values match the current `docker-compose*.yml`, frontend runtime URL detection, and env templates.

## Fresh-clone quick start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker Engine with `docker compose`

### Full stack with Docker

```bash
npm run install:all
python -m pip install -r src/ai/requirements.txt
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

Open:

```text
https://127.0.0.1:3090
```

### Run services individually

```bash
# backend
cd src/backend && npm install && npm run dev

# frontend
cd src/frontend && npm install && npm run dev

# ai service
cd src/ai && python -m pip install -r requirements.txt && python main.py
```

## Current auth behavior

The checked-in frontend dev mode commonly uses `VITE_DISABLE_AUTH=true`.

That means:
- the app auto-creates a local `dev-admin` session
- `/login` redirects into the app shell
- the default browser suite skips the login-form-only tests

If you need the real login UI, set `VITE_DISABLE_AUTH=false` and restart the frontend.

## OpenAI voice defaults

These defaults were rechecked against official OpenAI docs on March 6, 2026.

- TTS: `gpt-4o-mini-tts`
- STT: `gpt-4o-transcribe`
- Diarization: `gpt-4o-transcribe-diarize`
- Recommended chained architecture: `gpt-4o-transcribe -> gpt-4.1 -> gpt-4o-mini-tts`

Official references:
- [Voice agents guide](https://developers.openai.com/api/docs/guides/voice-agents/)
- [Audio and speech guide](https://developers.openai.com/api/docs/guides/audio/)
- [Create speech reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create/)
- [Create transcription reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create/)

## Validation commands

```bash
# backend
cd src/backend && npm run lint && npm run build && npm test -- --runInBand
cd src/backend && RUN_DB_TESTS=true npm test -- --runInBand

# frontend
cd src/frontend && npm run lint && npm run build && npm run test:run

# ai
cd src/ai && python test_langgraph_setup.py

# voice
cd /Users/morlock/fun/02_PowerShell_Projects/psscript
node scripts/voice-tests-1-8.mjs --base-url https://127.0.0.1:4000 --insecure-tls

# data maintenance
node scripts/verify-data-maintenance-e2e.mjs --reuse-backend --base-url https://127.0.0.1:4000 --insecure-tls

# browser
npx playwright test --project=chromium
```

## Current engineering state

- Shared JWT auth middleware is used across normal protected routes and admin DB routes.
- Script creation persists immediately and runs AI analysis in the background.
- Restore reseeds sequences and restores tables in foreign-key-safe order.
- Backend AI routes no longer return fabricated fallback success payloads.
- Frontend route-level lazy loading is enabled.
- Local fresh-clone defaults are normalized around `3090 / 4000 / 8000`.

## Canonical docs

- [Backend README](./src/backend/README.md)
- [Frontend README](./src/frontend/README.md)
- [AI README](./src/ai/README.md)
- [Getting Started](./docs/GETTING-STARTED.md)
- [Data Maintenance](./docs/DATA-MAINTENANCE.md)
- [Voice API](./docs/README-VOICE-API.md)
- [Authentication Improvements](./docs/AUTHENTICATION-IMPROVEMENTS.md)
- [Updates](./docs/UPDATES.md)
- [Documentation Hub](./docs/index.md)

`docs/README-GITHUB.md` is retained only as an archive note; the root `README.md` is the GitHub landing page source of truth.
