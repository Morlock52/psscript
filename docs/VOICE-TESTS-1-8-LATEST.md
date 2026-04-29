# Voice API Tests 1-8

Last updated: April 28, 2026.

This document preserves the latest detailed voice test result while clarifying the current hosted route shape.

## Current Hosted Routes

Voice routes are served by Netlify Functions under the same-origin API:

- `GET /api/voice/voices`
- `GET /api/voice/settings`
- `PUT /api/voice/settings`
- `POST /api/voice/synthesize`
- `POST /api/voice/recognize`

Production base URL:

```text
https://pstest.morloksmaze.com
```

## Latest Detailed Test Artifact

The latest full Voice Tests 1-8 run in this repo was captured on March 6, 2026 against the local backend path. It passed `8/8` checks:

- route checks
- concurrency/load success
- format matrix behavior
- robustness behavior
- failure-path status codes
- cache repeat behavior
- security guardrails
- telemetry capture

## March 6 Metrics

| Check | Result |
| --- | --- |
| synthesize route | `200` in `2750ms` |
| recognize route | `200` in `1674ms` |
| 10 concurrency | `10/10` successful |
| 25 concurrency | `25/25` successful |
| 50 concurrency | `50/50` successful |
| cache repeat | first `1147ms`, second `67ms` |

## Current Retest Command Shape

Use hosted API routes when adapting the voice test script:

```bash
node scripts/voice-tests-1-8.mjs --base-url https://pstest.morloksmaze.com
```

If the script still expects the old local backend URL, update it before treating hosted voice as fully retested.
