# PSScript Support and Operations

This guide defines how to get help, how issues are triaged, and what operational checks should be performed before escalation.

## Support entry points

| Channel | Purpose | Best for |
| --- | --- | --- |
| GitHub Issues | Bug reports and feature requests | Product issues and reproducible defects |
| Docs and Training | Self-service guides | Onboarding, workflows, and troubleshooting |
| Logs and health checks | Operational diagnostics | Service availability and performance |

## Before you open an issue

- Confirm the problem is reproducible
- Capture steps, expected behavior, and actual behavior
- Include logs from backend and AI service
- Include screenshots if UI related

## Issue triage checklist

| Step | Owner | Outcome |
| --- | --- | --- |
| Reproduce | Reporter | Clear reproduction steps |
| Classify | Maintainer | Bug, feature, or support |
| Assign | Maintainer | Owner and priority set |
| Verify fix | Maintainer | Regression or unit test added |

## Operational checks

### Health endpoints

- Backend: http://localhost:4000/health
- Backend API: http://localhost:4000/api/health
- AI service: http://localhost:8000/health

### Log locations

- Backend logs: `src/backend/logs/`
- AI service logs: `src/ai/logs/` (if configured)
- Netlify deploy logs: Netlify project deploy log for `psscript`

### Common recovery actions

```bash
# Restart all services
./restart-all.sh

# Restart backend only
./restart-backend.sh
```

### Data Maintenance Escalation

If maintenance actions fail:

1. Save the exact API request/response payload for:
   - `POST /api/admin/db/backup`
   - `POST /api/admin/db/restore`
   - `POST /api/admin/db/clear-test-data`
2. Capture backup directory state:
    - run `ls -l $(echo $DB_BACKUP_DIR || echo /tmp/psscript-db-backups)`
3. Collect recent server logs:
    - `tail -n 200 src/backend/logs/backend.log`
4. Open a support ticket with:
    - environment (`netlify` / hosted API / local),
    - user role used,
    - endpoint payload,
    - and backup filename involved.
5. Include smoke-check output (`--smoke-only` / `--no-smoke`) or the `DB_STRESS_REPORT_FILE` artifact for endpoint-level diagnostics.
6. If testing rollback behavior, include the `--restore-after-clear` mode output and note whether `restoredAfterClear.success` stayed true.

### Data Maintenance Stress Test Failures

If the stress test script fails:

1. Save the generated report:
   - `export DB_STRESS_REPORT_FILE=/tmp/data-maintenance-stress.json`
   - rerun `npm run stress:data-maintenance`
   - or run `npm run verify:data-maintenance:e2e -- --base-url http://localhost:3001` for full startup + smoke+restore verification
2. Attach API request log and the report file to the ticket.
3. If failure occurred in GitHub Actions, include artifacts from `maintenance-smoke-logs`.
4. If you see `Created backup was not listed by /api/admin/db/backups`, verify all maintenance requests hit the same backend instance and that `DB_BACKUP_DIR` is shared/persistent for that instance.

### Voice API Tests 1-8 Failures

If voice tests fail:

1. Run the local report command:
   - `npm run test:voice:1-8:report`
2. Attach both artifacts to the support ticket:
   - `/tmp/voice-tests-1-8-latest.json`
   - `docs/VOICE-TESTS-1-8-LATEST.md`
3. Include the backend and AI service logs around the failure window:
   - backend and AI service deploy/runtime logs for the same timestamp window
4. If authentication checks fail unexpectedly, include:
   - `AUTH_ENABLED`, `DISABLE_AUTH`, and route middleware config details.
5. If invalid-key behavior fails (expected `401`), include:
   - whether `x-openai-api-key` was provided,
   - and whether the same text was used in previous synth requests.
6. If telemetry checks fail, include output from:
   - `GET /api/analytics/ai/summary` before and after one synth+recognize call.

## Severity guide

| Severity | Description | Example |
| --- | --- | --- |
| Sev 1 | Production down or data loss | Cannot log in, data missing |
| Sev 2 | Critical workflow blocked | Upload or analysis failing |
| Sev 3 | Degraded experience | Slow responses, partial UI |
| Sev 4 | Cosmetic or enhancement | UI polish, copy changes |

## Security reporting

If you believe you have found a security issue, do not open a public issue. Share details privately with the project owner.

## Reference docs

- `docs/GETTING-STARTED.md`
- `docs/training-suite/README.md`
- `docs/training-suite/TRAINING-GUIDE.md`
