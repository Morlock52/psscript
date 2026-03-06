# Voice API Tests 1-8 (Latest)

Run date: 2026-03-06T20:11:47.213Z
Base URL: `https://127.0.0.1:4000`

## Summary

- Passed checks: `8/8`
- Failed checks: `0`
- This result was reproduced in the latest full validation pass on March 6, 2026.

Checks:
- PASS `test1`: core route checks
- PASS `test2`: concurrency/load success
- PASS `test3`: format matrix behavior
- PASS `test4`: robustness behavior
- PASS `test5`: failure-path status codes
- PASS `test6`: cache repeat behavior
- PASS `test7`: security guardrails
- PASS `test8`: telemetry captures voice endpoints

## Key metrics from the latest run

- synthesize route: `200` in `2750ms`
- recognize route: `200` in `1674ms`
- load test `10` concurrency: `10/10` successful
- load test `25` concurrency: `25/25` successful
- load test `50` concurrency: `50/50` successful
- cache check: first `1147ms`, second `67ms`
- telemetry check: both `/api/voice/synthesize` and `/api/voice/recognize` were captured

## Format matrix

Expected and observed behavior:
- `mp3`, `wav`, `flac`: synth `200`, recognize `200`
- `opus`: synth `200`, recognize `400`

## Robustness cases

- silence wav: `200`
- random noise payload: `400`
- accented English phrase: `200`
- Spanish phrase: `200`

## Failure-path cases

- invalid OpenAI key: `401`
- malformed base64: `400`
- missing text: `400`
- oversized text: `413`
- oversized audio payload: `413`

## Command

```bash
node scripts/voice-tests-1-8.mjs --base-url https://127.0.0.1:4000 --insecure-tls
```
