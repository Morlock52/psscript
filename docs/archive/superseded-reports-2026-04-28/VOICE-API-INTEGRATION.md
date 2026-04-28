# Voice API Integration

This document is retained for continuity, but the original implementation plan it contained is now historical.

## Canonical Current Docs

Use these files for current behavior and operations:

- `docs/README-VOICE-API.md`
- `docs/VOICE-API-ARCHITECTURE.md`
- `docs/VOICE-API-INTEGRATION-SUMMARY.md`
- `docs/VOICE-API-NEXT-STEPS.md`
- `docs/VOICE-TESTS-1-8-LATEST.md`
- `docs/SUPPORT.md`

## Current Implementation Snapshot (2026-02-14)

- OpenAI-backed voice synthesis + recognition are active.
- Backend voice controller enforces payload constraints and format validation.
- Voice routes are protected and excluded from generic response cache.
- Telemetry includes voice endpoints in AI analytics summary.
- Canonical test runner: `scripts/voice-tests-1-8.mjs`.

## Why this file changed

The earlier content described a future-state multi-provider rollout. That no longer matches the deployed code path and was causing documentation drift. Historical plans can be restored from git history if needed.
