# PSScript

PowerShell script management with AI analysis, semantic search, documentation crawl tooling, database maintenance workflows, and OpenAI-backed voice features.

## Overview

PSScript is a full-stack application for teams that need to store, search, analyze, document, and operate on PowerShell scripts from one interface.

Core product areas:
- script upload, storage, versioning, and detail views
- AI-assisted analysis, remediation guidance, and semantic search
- documentation crawling and indexed knowledge capture
- analytics, admin operations, and data-maintenance tooling
- OpenAI-backed speech synthesis and speech recognition
- optional local Git auto-fetch and guarded fast-forward update workflow

## How it works

1. A user uploads or creates a PowerShell script in the React frontend.
2. The Express API validates the request, persists the script and version history in PostgreSQL, and exposes search, maintenance, analytics, and admin routes.
3. The AI service performs analysis, embeddings, LangGraph orchestration, and voice processing through current OpenAI models.
4. The UI surfaces script health, AI results, semantic discovery, documentation data, and admin tooling from those backend services.
5. A global voice dock lets users dictate into focused inputs and read current app content back through the same backend voice pipeline.

## Screenshots

These screenshots reflect the current local product flow and the main surfaces that are linked from the GitHub landing page.

| Dashboard | Scripts |
| --- | --- |
| ![Dashboard screenshot](./docs/screenshots/dashboard.png) | ![Scripts screenshot](./docs/screenshots/scripts.png) |

| Settings | Data maintenance |
| --- | --- |
| ![Settings screenshot](./docs/screenshots/settings-profile.png) | ![Data maintenance screenshot](./docs/screenshots/data-maintenance.png) |

What you are seeing:
- `Dashboard`: high-level health, activity, and AI/usage surfaces
- `Scripts`: upload, browsing, filtering, and analysis entry points
- `Settings`: profile and application configuration
- `Data maintenance`: admin backup, restore, and cleanup workflows

## Feature Summary

| Area | What it does |
| --- | --- |
| Script management | Uploads, stores, versions, filters, and searches PowerShell scripts |
| AI analysis | Runs analysis, scoring, and remediation workflows without returning fabricated fallback success payloads |
| Semantic search | Uses embeddings for similarity-based search and related-script discovery |
| Voice workflows | Supports OpenAI-backed text-to-speech, transcription, diarization, and listening flows |
| Documentation crawl | Crawls and indexes documentation content for in-app access |
| Admin maintenance | Provides backup, restore, and test-data cleanup endpoints with sequence reseeding and FK-safe restore ordering |
| Analytics | Exposes reporting and usage flows through the backend API and UI |
| Local repo maintenance | Includes an optional helper to auto-fetch `origin/main`, notify on changes, and fast-forward only when the worktree is clean |

## Architecture

| Service | Local URL |
| --- | --- |
| Frontend | `https://127.0.0.1:3090` |
| Backend API | `https://127.0.0.1:4000/api` |
| AI service | `http://127.0.0.1:8000` |
| PostgreSQL | `127.0.0.1:5432` |
| Redis | `127.0.0.1:6379` |

Stack:
- frontend: React, TypeScript, Vite
- backend: Express, TypeScript, Sequelize
- AI service: FastAPI, LangGraph, OpenAI
- infra: Docker Compose, PostgreSQL, Redis

## Request flow

```text
Browser UI
  -> Express API
     -> PostgreSQL / Redis
     -> FastAPI AI service
        -> OpenAI models
```

In practice:
- script CRUD, categories, analytics, and admin maintenance are handled through the backend API
- AI analysis and voice routes proxy through the backend into the AI service
- semantic search and related-script features depend on stored embeddings
- admin DB maintenance flows operate directly against persisted application data

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker Engine with `docker compose`

### Run the full local stack

```bash
npm run install:all
python -m pip install -r src/ai/requirements.txt
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

Open:

```text
https://127.0.0.1:3090
```

Then use:
- `/dashboard` for the main operational view
- `/scripts` to upload, inspect, and analyze PowerShell files
- `/settings/categories` for category management
- `/settings/data` for backup and restore tooling
- `/analytics/ai` for AI usage and cost views

Voice workflow:
- use the floating `Voice` dock in the app shell
- focus any text input, then use `Dictate to input` to transcribe speech into that field
- select text or leave the current page active, then use `Speak selection` to generate spoken output

### Run services individually

```bash
# backend
cd src/backend
npm install
npm run dev

# frontend
cd src/frontend
npm install
npm run dev

# ai service
cd src/ai
python -m pip install -r requirements.txt
python main.py
```

## Current Local Dev Behavior

- the checked-in frontend dev flow commonly uses `VITE_DISABLE_AUTH=true`
- in that mode, the app auto-creates a local `dev-admin` session
- `/login` redirects into the app shell instead of showing the login form
- if you need the real login screen, set `VITE_DISABLE_AUTH=false` and restart the frontend

## OpenAI Voice Defaults

These values were kept aligned with the current official OpenAI audio and voice-agent documentation.

- reasoning and analysis: `gpt-4.1`
- text-to-speech: `gpt-4o-mini-tts`
- speech-to-text: `gpt-4o-mini-transcribe`
- diarization: `gpt-4o-transcribe-diarize`
- embeddings: `text-embedding-3-large`

References:
- [OpenAI voice agents guide](https://developers.openai.com/api/docs/guides/voice-agents/)
- [OpenAI audio and speech guide](https://developers.openai.com/api/docs/guides/audio/)
- [OpenAI create speech reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create/)
- [OpenAI create transcription reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create/)

Model choice notes:
- OpenAI recommends the chained voice architecture `gpt-4o-transcribe -> gpt-4.1 -> gpt-4o-mini-tts` for controlled application workflows.
- The current OpenAI changelog recommends `gpt-4o-mini-transcribe` over `gpt-4o-transcribe` for best results.
- This project keeps `gpt-4.1` for the reasoning layer and uses the faster audio-specialized models for speech input/output.

## Validation

### Main validation commands

```bash
# backend
cd src/backend
npm run lint
npm run build
npm test -- --runInBand
RUN_DB_TESTS=true npm test -- --runInBand

# frontend
cd src/frontend
npm run lint
npm run build
npm run test:run

# ai
cd src/ai
python test_langgraph_setup.py

# voice
cd /Users/morlock/fun/02_PowerShell_Projects/psscript
node scripts/voice-tests-1-8.mjs --base-url https://127.0.0.1:4000 --insecure-tls

# data maintenance
node scripts/verify-data-maintenance-e2e.mjs --reuse-backend --base-url https://127.0.0.1:4000 --insecure-tls

# browser
npx playwright test --project=chromium
```

### Latest recorded results

Validated on March 8, 2026:

- backend tests: `93` passed
- frontend tests: `33` passed
- AI harness: `5/5` passed
- voice validation: `8/8` passed
- Chromium browser smoke suite: `25` passed

This reflects the actively used smoke set:
- health checks
- script upload and analysis flow
- categories/settings CRUD
- AI analytics
- AI agent endpoints

## Current Engineering Notes

- shared JWT auth middleware is used across protected routes and admin DB routes
- script uploads authenticate through the same middleware path as the rest of the API
- upload handlers now support both memory-backed and disk-backed multer flows, so large-file uploads do not fail on missing `req.file.buffer`
- concurrent upload transactions use `READ_COMMITTED` to avoid PostgreSQL serialization failures during short upload bursts
- script creation persists immediately and runs AI analysis in the background
- backend AI routes return explicit failures instead of invented success payloads
- backup listing is live after backup creation and restore reseeds sequences correctly
- frontend route-level lazy loading is enabled
- local defaults are normalized around `3090 / 4000 / 8000`
- voice silence input is gated before transcription so silent audio returns empty text instead of hallucinated speech
- backend voice timeouts now return `504` instead of being flattened into generic service-unavailable failures

## Optional Git Auto-Update Helper

The repo now includes:

- [git-auto-update.sh](./scripts/setup/git-auto-update.sh)

The helper is intended for local macOS use with `launchd` and does three things:
- fetches `origin/main` every few minutes
- sends a notification when `origin/main` changes
- runs `git pull --ff-only origin main` only when the current branch is `main` and the worktree is clean

## Documentation

- [Backend README](./src/backend/README.md)
- [Frontend README](./src/frontend/README.md)
- [AI README](./src/ai/README.md)
- [Getting Started](./docs/GETTING-STARTED.md)
- [Data Maintenance](./docs/DATA-MAINTENANCE.md)
- [Voice API](./docs/README-VOICE-API.md)
- [Authentication Improvements](./docs/AUTHENTICATION-IMPROVEMENTS.md)
- [Updates](./docs/UPDATES.md)
- [Documentation Hub](./docs/index.md)

## README Notes

This root `README.md` is the canonical GitHub landing page.

Formatting choices in this file were updated to match GitHub README best-practice patterns documented in GitHub’s Markdown and README guidance, including:
- clear heading hierarchy
- relative-image embeds
- tables for service layout and feature summaries
- short, task-oriented setup and validation sections
