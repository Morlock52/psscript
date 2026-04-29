# PSScript Training Suite

Last updated: April 29, 2026.

This training suite is aligned to the current hosted PSScript app: Netlify for the UI/API, hosted Supabase for Auth/Postgres, admin approval for access, responsive desktop/mobile UI, upload/delete management, AI analysis, PDF analysis export, and support operations.

The suite teaches the full lifecycle of script design and management: intake, design review, upload, metadata, analysis, remediation, discovery, export, deletion, governance, and support.

## Lifecycle Map

![Script lifecycle map](../graphics/script-lifecycle-map-2026-04-29.svg)

The operating model follows three rules:

- Hosted Supabase is the system of record. Do not use a local database for training or production workflows.
- Netlify deploys the UI and API functions together, so training and support evidence should include the active deploy URL and Function logs.
- Every script lifecycle action should leave evidence: metadata, analysis result, PDF report, support note, or cleanup record.

## What You Will Learn

| Capability | What it teaches | Current screen |
| --- | --- | --- |
| Access | Supabase login, pending approval, enabled profile gate | `../screenshots/readme/login.png` |
| Script intake | Uploads, metadata, versioning, delete, bulk delete | `../screenshots/readme/scripts.png` |
| AI analysis | Criteria payload, security score, remediation, PDF export | `../screenshots/readme/analysis.png` |
| Discovery | Keyword/vector search and documentation-assisted review | `../screenshots/readme/documentation.png` |
| Assistant | Chat and agentic route aliases through `/ai/assistant` | `../screenshots/readme/agentic-assistant.png` |
| Operations | Netlify deploy health, Supabase-backed data maintenance | `../screenshots/readme/data-maintenance.png` |
| Mobile | Topbar, drawer navigation, responsive cards | `../screenshots/readme/dashboard.png` |

## Current Environment

- Production app: `https://pstest.morloksmaze.com`
- API: same-origin Netlify Functions under `/api/*`
- Database: hosted Supabase Postgres with RLS and `pgvector`
- Auth: Supabase Auth plus admin approval
- Local database: not used
- Upload limit: hosted uploads are capped at 4 MB in the UI to stay below Netlify buffered Function payload limits after binary overhead.

For classroom UI walkthroughs that must avoid hosted mutations, run the frontend locally with mock data:

```bash
cd src/frontend
VITE_DISABLE_AUTH=true VITE_USE_MOCKS=true npm run dev -- --host 127.0.0.1 --port 5173
```

For production-like auth labs, use the hosted app and an approved account.

## Screenshot Gallery

Use the screenshot atlas when building training decks or support runbooks: [`SCREENSHOT-ATLAS.md`](./SCREENSHOT-ATLAS.md).

![Production login](../screenshots/readme/login.png)

![Dashboard](../screenshots/readme/dashboard.png)

![Scripts](../screenshots/readme/scripts.png)

![Upload](../screenshots/readme/upload.png)

![Script detail](../screenshots/readme/script-detail.png)

![Analysis](../screenshots/readme/analysis.png)

![Documentation](../screenshots/readme/documentation.png)

![Agentic assistant](../screenshots/readme/agentic-assistant.png)

![Data maintenance](../screenshots/readme/data-maintenance.png)

![Settings profile](../screenshots/readme/settings-profile.png)

## Curriculum Map

| Module | Description | Duration | File |
| --- | --- | --- | --- |
| Module 01 | Platform Foundations | 45 min | `modules/module-01-foundations.md` |
| Module 02 | Script Lifecycle | 60 min | `modules/module-02-lifecycle.md` |
| Module 03 | AI Analysis and PDF Export | 75 min | `modules/module-03-analysis.md` |
| Module 04 | Search and Discovery | 45 min | `modules/module-04-search.md` |
| Module 05 | Operations and Governance | 60 min | `modules/module-05-operations.md` |

## Professional Support Suite

| Document | Use |
| --- | --- |
| [`SCRIPT-LIFECYCLE-SUITE-2026-04-29.md`](./SCRIPT-LIFECYCLE-SUITE-2026-04-29.md) | Complete script design and management lifecycle playbook |
| [`TRAINING-GUIDE.md`](./TRAINING-GUIDE.md) | Facilitator agenda, role paths, lab timing, and evaluation |
| [`SCREENSHOT-ATLAS.md`](./SCREENSHOT-ATLAS.md) | Screenshot inventory and recommended use |
| [`../SUPPORT.md`](../SUPPORT.md) | Support intake, escalation, and operational evidence guide |

## Labs

| Lab | Goal | File |
| --- | --- | --- |
| Lab 01 | Upload, analyze, and export a script report | `labs/lab-01-upload-analyze.md` |
| Lab 02 | Search and similarity | `labs/lab-02-vector-search.md` |
| Lab 03 | Documentation and assistant workflows | `labs/lab-03-docs-chat.md` |
| Lab 04 | Analytics and governance checks | `labs/lab-04-analytics.md` |
| Lab 05 | Governance, support evidence, and safe cleanup | `labs/lab-05-governance-support.md` |

## Assessment Rubric

| Skill area | Basic | Proficient | Advanced |
| --- | --- | --- | --- |
| Access | Signs in and recognizes pending approval | Explains enabled-profile gate | Troubleshoots redirects and profile state |
| Script hygiene | Uploads and tags scripts | Uses versioning and dedup signals | Safely deletes/bulk deletes test data |
| AI analysis | Reads scores | Applies remediation | Exports and shares PDF evidence |
| Search | Uses keyword search | Applies filters | Explains embedding-backed similarity |
| Operations | Reads health state | Uses Netlify/Supabase logs | Runs safe backup-first maintenance |
| Mobile | Opens key screens | Uses drawer navigation | Confirms no overlap at phone width |

## Support

- Current setup: `../GETTING-STARTED.md`
- Production deployment: `../NETLIFY-SUPABASE-DEPLOYMENT.md`
- Support and escalation: `../SUPPORT.md`
- Data maintenance: `../DATA-MAINTENANCE.md`
