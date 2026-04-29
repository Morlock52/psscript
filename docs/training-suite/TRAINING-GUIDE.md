# PSScript Training Guide

Last updated: April 29, 2026.

This guide trains users on the current hosted app at `https://pstest.morloksmaze.com`.

## Program Overview

PSScript is a governed workspace for PowerShell scripts. The current training path covers:

- Supabase Auth and admin approval
- script upload, metadata, versioning, delete, and bulk delete
- full script design and management lifecycle
- AI analysis using the current criteria payload
- PDF analysis export
- keyword and vector-backed discovery
- assistant and agentic route aliases
- hosted operations through Netlify and Supabase
- mobile navigation and responsive pages

![Training support suite map](../graphics/training-support-suite-map-2026-04-29.svg)

## System Overview

| Layer | Current implementation |
| --- | --- |
| UI | React/Vite on Netlify |
| API | Netlify Functions under `/api/*` |
| Auth | Supabase Auth plus `app_profiles.is_enabled` |
| Data | hosted Supabase Postgres with RLS and `pgvector` |
| AI | hosted provider calls through Netlify Functions |
| Backups | admin-only hosted data maintenance |

## Feature Cheat Sheet

| Area | What to verify | Screenshot |
| --- | --- | --- |
| Login | Supabase login and Google OAuth entry | `../screenshots/readme/login.png` |
| Dashboard | Desktop and mobile cards render without overlap | `../screenshots/readme/dashboard.png` |
| Scripts | List, filters, delete, bulk selection | `../screenshots/readme/scripts.png` |
| Upload | File intake, metadata, and hosted 4 MB limit | `../screenshots/readme/upload.png` |
| Analysis | Scores, criteria, remediation, PDF export | `../screenshots/readme/analysis.png` |
| Assistant | `/agentic` resolves to assistant instead of 404 | `../screenshots/readme/agentic-assistant.png` |
| Settings | Profile and admin surfaces | `../screenshots/readme/settings-profile.png` |
| Data maintenance | Backup-first admin maintenance | `../screenshots/readme/data-maintenance.png` |

## Environment Setup

Use production for training with approved accounts:

```text
https://pstest.morloksmaze.com
```

Use local mock mode only for screenshot rehearsal or non-mutating classroom demos:

```bash
cd src/frontend
VITE_DISABLE_AUTH=true VITE_USE_MOCKS=true npm run dev -- --host 127.0.0.1 --port 5173
```

Do not configure a local database for training. Database-backed exercises use hosted Supabase.

## Guided Walkthrough

1. Sign in with an approved account.
2. If you land on pending approval, ask an admin to enable your profile.
3. Review dashboard status on desktop or mobile.
4. Open Scripts and inspect list controls.
5. Design a safe test `.ps1` file with purpose, owner, examples, and test expectation.
6. Upload the script with category, tags, and description.
7. Open the script detail page.
8. Run or view AI analysis.
9. Export the analysis report and confirm the download is a PDF.
10. Search for the script by keyword and by meaning.
11. Open `/agentic` and confirm it routes to the assistant.
12. Open Settings -> Data Maintenance as an admin and review backup controls without running destructive actions.
13. Delete only disposable test scripts and record cleanup evidence.

## Role-Based Paths

| Role | Focus |
| --- | --- |
| Script author | upload, metadata, analysis, PDF export |
| Security reviewer | criteria payload, findings, remediation, evidence |
| Platform admin | approval gate, backups, logs, data maintenance |
| Mobile reviewer | topbar, drawer, dashboard, script list, settings |
| Support analyst | reproduction notes, screenshots, deploy id, Function logs, Supabase logs |

## Hands-On Labs

### Lab 01: Upload, Analyze, Export

1. Upload a safe test script.
2. Review scores and findings.
3. Export the analysis PDF.
4. Confirm the file is a PDF, not JSON.

### Lab 02: Search And Similarity

1. Search by cmdlet or title.
2. Search by a natural-language description.
3. Compare ranking and relevance.

### Lab 03: Assistant And Documentation

1. Open the assistant.
2. Ask for a safe remediation pattern.
3. Open `/agentic` and confirm it lands in the assistant experience.

### Lab 04: Operations And Governance

1. Check `https://pstest.morloksmaze.com/api/health`.
2. Review Netlify deploy state and Function logs.
3. Review Supabase logs for API/database failures.
4. Open Settings -> Data Maintenance and confirm backup list access as an admin.

### Lab 05: Governance, Support, Cleanup

1. Capture a support-ready screenshot and route.
2. Verify PDF export and delete behavior on disposable test data.
3. Record Netlify/Supabase evidence fields for the case.
4. Confirm cleanup without touching unrelated production records.

## Operational Readiness

| Area | Check | Target |
| --- | --- | --- |
| Netlify app | production URL loads | 200/app shell |
| Netlify Functions | `/api/health` returns hosted status | healthy/degraded with reason |
| Supabase | Auth and database reachable | no auth/DB errors |
| RLS | disabled users blocked | `403 account_pending_approval` |
| Export | analysis report download | PDF content type |
| Mobile | dashboard/navigation readable | no overlap |
| Data maintenance | backup list/create | admin only |
| Upload size | hosted upload route | UI blocks files above 4 MB |
| Delete | disposable test scripts | intended records removed only |

## Troubleshooting

| Issue | Likely cause | Fix |
| --- | --- | --- |
| Pending approval | profile exists but is disabled | admin enables user in Settings -> User Management |
| `/agentic` 404 | stale deploy or redirect mismatch | redeploy Netlify and verify redirects |
| Export is JSON | old frontend/API build | redeploy and verify `/api/scripts/:id/export-analysis` headers |
| Delete fails | auth/ownership/admin mismatch | inspect API response and user role |
| Data maintenance fails | non-admin user or Supabase route error | check Netlify Function logs and Supabase logs |
| Mobile overlap | stale frontend deploy | verify latest production deploy and screenshots |

## Source-Guided Training Notes

- PowerShell lifecycle training should emphasize static analysis, documentation, examples, tests, versioning, and code signing where appropriate.
- Netlify support training should tie issues to the active deploy because functions and frontend assets are deployed together and are immutable per deploy.
- Supabase training should treat RLS, explicit policies, hosted backups, MFA, and service-key protection as core operating controls.

Primary sources:

- <https://learn.microsoft.com/en-us/powershell/gallery/concepts/publishing-guidelines?view=powershellget-3.x>
- <https://docs.netlify.com/build/functions/overview/>
- <https://supabase.com/docs/guides/database/postgres/row-level-security>
- <https://supabase.com/docs/guides/deployment/going-into-prod>

## Appendix

- Support: `../SUPPORT.md`
- Deployment: `../NETLIFY-SUPABASE-DEPLOYMENT.md`
- Data maintenance: `../DATA-MAINTENANCE.md`
- Screenshots: `SCREENSHOT-ATLAS.md`
