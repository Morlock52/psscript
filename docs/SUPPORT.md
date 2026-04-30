# PSScript Support and Operations

Last updated: April 29, 2026.

This guide reflects the active hosted app at `https://pstest.morloksmaze.com`.

![Support escalation ladder](./graphics/support-escalation-ladder-2026-04-29.svg)

## Corporate Support Training Model

Support training should read like an operating playbook, not a bug list. Start with the role workflow, gather current screenshots, then attach hosted evidence from Netlify and Supabase before escalating.

![Role-based training workflow](./graphics/training-role-workflow-2026-04-29.svg)

![Training readiness scorecard](./graphics/training-readiness-scorecard-2026-04-29.svg)

## Support Training Outcomes

| Audience | What they need from this guide | Correct behavior |
| --- | --- | --- |
| Basic user | Know what evidence to send when something fails | Share route, screenshot, script name, expected result, and actual result |
| New beginner | Understand when not to retry destructive actions | Stop after one failed delete/export/upload and ask for help with the response text |
| Senior engineer | Reproduce the workflow and isolate app, API, data, or provider failure | Attach script id, request payload shape, response status, and likely code surface |
| Admin or support | Triage with hosted Netlify and Supabase evidence | Check role, enabled profile, Function logs, Supabase logs, and backup state |
| C-level management | See whether the issue is availability, data risk, or process risk | Review severity, impacted workflow, mitigation, and owner |

## Before Opening An Issue

- Reproduce the issue and write exact steps.
- Capture the expected behavior and actual behavior.
- Include screenshots for UI problems.
- Include the production URL or preview deploy URL.
- Include Netlify Function logs and Supabase logs for the failure window when the issue involves data, auth, or API behavior.
- Confirm whether the record is disposable test data or production data before attempting delete, bulk delete, restore, or cleanup actions.

## Operational Checks

| Area | Check |
| --- | --- |
| Production app | Open `https://pstest.morloksmaze.com` |
| Hosted API | `curl -fsS https://pstest.morloksmaze.com/api/health` |
| Auth | Sign in through Supabase Auth and confirm enabled profile access |
| Database | Confirm Supabase connection from the health payload and Supabase dashboard logs |
| Deploy | Review the latest Netlify production deploy and Function logs |
| Mobile | Check dashboard, navigation drawer, scripts, and settings at phone width |
| Upload | Confirm file size is below the hosted 4 MB limit |
| Export | Confirm analysis export returns a PDF content type |

Local Express and FastAPI services can still be used by developers, but they are not the production support path.

## Common Escalations

| Symptom | First check | Evidence to attach |
| --- | --- | --- |
| Login loop or pending approval | Supabase redirect allow-list and `app_profiles.is_enabled` | user email, callback URL, API response |
| `/agentic` returns 404 | Netlify redirects and current deploy id | URL, deploy id, browser screenshot |
| Analysis export downloads wrong type | `/api/scripts/:id/export-analysis` response headers | script id, headers, downloaded filename |
| Script delete or bulk delete fails | enabled profile, ownership/admin role, route response | script ids, request id, route payload |
| Data maintenance fails | admin role and Supabase backup record | backup id, route response, Netlify logs |
| Mobile layout overlaps | viewport width and route | screenshot, device/browser |

## Intake Template

```text
Summary:
Severity:
Environment URL:
Netlify deploy id:
User email/role:
Route:
Timestamp and timezone:
Expected behavior:
Actual behavior:
Steps to reproduce:
Screenshots:
API response/status:
Netlify Function log window:
Supabase Auth/database log window:
Data involved:
Cleanup or rollback needed:
```

## Data Maintenance Escalation

For Settings -> Data Maintenance issues, collect:

1. Admin user email.
2. Exact action: list backups, backup, restore, or clear test data.
3. Route response payload.
4. Netlify Function log lines for `/api/admin/db/*`.
5. Supabase logs and backup row status.
6. Confirmation text and `backupFirst` value for destructive actions.

Do not run a production restore or cleanup as a diagnostic step without explicit approval.

## Upload, Export, And Delete Escalation

For script lifecycle failures, collect:

| Workflow | Evidence |
| --- | --- |
| Upload | file size, filename, route, response status, Function logs |
| AI analysis | script id, criteria version, provider/fallback state, Function logs |
| PDF export | script id, response headers, downloaded filename, screenshot |
| Single delete | script id, title, owner, user role, response status |
| Bulk delete | selected ids, confirmation, response payload, remaining records |

Delete and cleanup diagnostics must use disposable test records unless the user explicitly approves work against production records.

## Voice And AI Escalation

Collect:

- route or UI surface used
- model/provider configured in Netlify env
- Netlify Function logs
- provider error payload, if present
- whether deterministic fallback rendered a structured analysis

## Severity Guide

| Severity | Description | Example |
| --- | --- | --- |
| Sev 1 | Production down or data-loss risk | Cannot log in; data missing after maintenance |
| Sev 2 | Critical workflow blocked | Upload, analysis, export, or delete is failing |
| Sev 3 | Degraded experience | Slow responses, partial UI, one route broken |
| Sev 4 | Cosmetic or documentation issue | Copy, screenshot, or minor layout polish |

## Training And Screenshot References

- [`training-suite/SCRIPT-LIFECYCLE-SUITE-2026-04-29.md`](./training-suite/SCRIPT-LIFECYCLE-SUITE-2026-04-29.md)
- [`training-suite/SCREENSHOT-ATLAS.md`](./training-suite/SCREENSHOT-ATLAS.md)
- [`training-suite/TRAINING-GUIDE.md`](./training-suite/TRAINING-GUIDE.md)

### High-Value Support Screenshots

![Analysis runtime requirements](./screenshots/readme/analysis-runtime-requirements.png)

![Data maintenance](./screenshots/readme/data-maintenance.png)

## Developer-Only Appendix

The production support path is Netlify plus hosted Supabase. The older local Express/FastAPI services are still useful for developer diagnostics, but they are not the database or API path for hosted training.

### Local Health Checks

```text
Backend: http://localhost:4000/health
Backend API: http://localhost:4000/api/health
AI service: http://localhost:8000/health
```

### Local Log And Recovery Notes

```bash
# Restart all local services
./restart-all.sh

# Restart local backend only
./restart-backend.sh
```

Developer logs may exist under `src/backend/logs/` and `src/ai/logs/` depending on local configuration.

### Historical Maintenance Stress Artifacts

When debugging local maintenance scripts or CI-only diagnostics, keep generated reports attached to the issue:

- `DB_STRESS_REPORT_FILE`
- `/tmp/data-maintenance-stress.json`
- `/tmp/voice-tests-1-8-latest.json`
- `docs/VOICE-TESTS-1-8-LATEST.md`

These artifacts do not replace hosted Netlify Function logs or Supabase logs for production incidents.

## References

- [`GETTING-STARTED.md`](./GETTING-STARTED.md)
- [`NETLIFY-SUPABASE-DEPLOYMENT.md`](./NETLIFY-SUPABASE-DEPLOYMENT.md)
- [`DATA-MAINTENANCE.md`](./DATA-MAINTENANCE.md)
- [`training-suite/README.md`](./training-suite/README.md)
