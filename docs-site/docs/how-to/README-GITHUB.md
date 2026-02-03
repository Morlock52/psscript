# PSScript Manager

AI-powered PowerShell script management: intake, analysis, discovery, agentic chat, and governance—presented in the same polished style used by top open-source GitHub READMEs (think Supabase/PostHog).

## Quick tour (screenshots)

- Login (demo-ready): ![Login](/images/screenshots/variants/login-v1.png)
- Dashboard (stats, trends, activity): ![Dashboard](/images/screenshots/variants/dashboard-v3.png)
- Script library (categories, owners, versions): ![Scripts](/images/screenshots/variants/scripts-v1.png)
- Upload with live preview + dedup hints: ![Upload](/images/screenshots/upload.png)
- AI analysis and remediation: ![Analysis](/images/screenshots/analysis.png)
- Documentation explorer and crawler: ![Documentation](/images/screenshots/variants/documentation-v1.png)
- Chat + agentic workflows: ![Chat](/images/screenshots/chat.png)
- Analytics and governance KPIs: ![Analytics](/images/screenshots/variants/analytics-v3.png)
- Settings with training/exports links: ![Settings](/images/screenshots/settings.png)

## Product highlights

- [x] Script intake: tagging, version history, hash-based deduplication
- [x] AI analysis: security scores, findings, remediation notes, audit trails
- [x] Discovery: keyword + vector search, documentation explorer, crawler
- [x] AI copilots: chat assistant, agent orchestration, history
- [x] Operations: analytics dashboards, exports (HTML/PDF/DOCX), health checks
- [x] Training suite: modules, labs, role paths, printable guides (linked in Settings)

## System at a glance

| Layer | What it does | Tech |
| --- | --- | --- |
| UI | React + Tailwind, Monaco editor, dark/light theming | Vite, React 18, Tailwind |
| API | Script CRUD, analysis orchestration, auth, docs crawl | Node.js/Express, Sequelize |
| AI | Analysis scoring, recommendations, embeddings | FastAPI, pgvector |
| Data | Postgres (pgvector), Redis cache | Dockerized services |
| Ops | Cloudflare tunnel, health checks, logs, exports | Docker Compose |

Architecture and flows:

- Architecture: ![Architecture](graphics/architecture.svg)
- Analysis pipeline: ![Analysis Pipeline](graphics/analysis-pipeline.svg)
- Script lifecycle: ![Script Lifecycle](graphics/lifecycle.svg)
- Search modes: ![Search Modes](graphics/search-modes.svg)
- Security scorecard: ![Security Scorecard](graphics/security-scorecard.svg)

## Getting started

### Fast mock start (best for demos/training)

```bash
./start-all-mock.sh
# Frontend: http://localhost:3002
# Backend API: http://localhost:4000/api
# AI service: http://localhost:8000
```

### Production Docker

```bash
./docker-deploy.sh
# Frontend: http://localhost:3002
# Backend API: http://localhost:4000
```

See `DOCKER-QUICKSTART.md` and `DOCKER-SETUP.md` for details.

### Local development

```bash
npm run install:all
npm run dev
```

### Playwright screenshots (used in this README)

```bash
./scripts/capture-readme-screenshots.sh
# Captures to docs/screenshots/*
```

## Training suite (supreme docs pack)

- Location: `docs/training-suite/`
- Contents: modules, labs, guided walkthrough, schedules, rubrics, screenshots
- In-app: Settings → Documentation & Training → Training Suite / PDFs / DOCX
- Exports: `scripts/export-docs.sh --all` → `docs/exports/{html,pdf,docx}/`
  - `docs/exports/pdf/Training-Suite.pdf`
  - `docs/exports/docx/Training-Suite.docx`

## Key workflows

| Flow | Steps | Where |
| --- | --- | --- |
| Upload & dedup | Upload → tags → hash check → version history | Scripts → Upload |
| AI review | Analyze → scores → findings → remediation notes | Scripts → Analysis |
| Discovery | Keyword + vector → filters → detail → history | Scripts / Documentation |
| Chat/agents | Ask for fixes, schedules, safety → save history | Chat / AI Assistant |
| Ops & governance | Analytics → scorecards → exports → health | Analytics / Settings |

## Environment & config

- `.env` samples: `src/frontend/.env`, `src/backend/.env`
- Mock mode toggles: `VITE_USE_MOCKS=true`, `USE_MOCK_SERVICES=true`
- Ports: UI 3002, API 4000, AI 8000 (mock defaults)
- CSRF/CORS dev origins: localhost:3000/3002 + 4000 (see `src/backend/src/middleware/security.ts`)

## Contributing and licenses

- Contributions welcome: see `CONTRIBUTING.md`
- License: MIT (`LICENSE`)

## Visual reference

![Documentation view](/images/screenshots/variants/documentation-v2.png)
