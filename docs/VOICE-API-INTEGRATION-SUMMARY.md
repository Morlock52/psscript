# Voice API Integration Summary

## Status

Voice integration is active and standardized on OpenAI as of February 14, 2026.

## Completed

- OpenAI TTS/STT implementation in AI service
- Backend voice route/controller hardening
- Voice defaults aligned to OpenAI voice IDs (`alloy` default)
- Security guardrails:
  - bearer token enforcement
  - payload size limits
  - explicit validation for formats/base64
- Cache hardening:
  - voice route cache skip in backend
  - API-key-scoped caching in AI service
- Telemetry coverage for voice endpoints
- Automated regression + stress checks via tests 1-8

## Validation

Latest canonical run:
- report: `docs/VOICE-TESTS-1-8-LATEST.md`
- json: `/tmp/voice-tests-1-8-latest.json`

Expected test posture:
- tests 1-8 pass
- invalid key => `401`
- malformed base64 => `400`
- oversized payload => `413`
- unauth voice route => `401`

## Primary Commands

- `npm run test:voice:1-8:local`
- `npm run test:voice:1-8:report`

## Canonical References

- `docs/README-VOICE-API.md`
- `docs/VOICE-API-ARCHITECTURE.md`
- `docs/SUPPORT.md`
