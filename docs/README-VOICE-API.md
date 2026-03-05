# Voice API

This is the canonical guide for voice features in PSScript as of February 14, 2026.

## Current Status

- Provider: **OpenAI** (TTS + STT)
- Backend routes: `GET/PUT/POST /api/voice/*`
- AI service routes: `POST /voice/synthesize`, `POST /voice/recognize`
- Default voice: `alloy`
- Automated validation: tests **1-8** via `scripts/voice-tests-1-8.mjs`

## Architecture

1. Frontend voice UI components call backend voice routes.
2. Backend `VoiceController` validates/authenticates requests and forwards to AI service.
3. AI service `voice_service.py` performs OpenAI TTS/STT.
4. Response is returned to backend and then frontend.

Primary files:
- `src/backend/src/controllers/VoiceController.ts`
- `src/backend/src/routes/voice.ts`
- `src/ai/voice_endpoints.py`
- `src/ai/voice_service.py`

## Configuration

Required:
- `OPENAI_API_KEY` in AI service environment

Common optional tuning:
- `VOICE_TTS_MODEL`
- `VOICE_STT_MODEL`
- `MAX_VOICE_TEXT_CHARS` (backend limit, default `6000`)
- `MAX_AUDIO_DATA_B64_CHARS` (backend limit, default `16000000`)

Per-request override (backend -> AI service passthrough):
- `x-openai-api-key` header

## API Reference

### `GET /api/voice/voices`
Returns available OpenAI voice catalog.

### `GET /api/voice/settings`
Returns persisted/user voice settings.

### `PUT /api/voice/settings`
Updates voice settings.

### `POST /api/voice/synthesize`
Request:
```json
{
  "text": "Hello from PSScript",
  "voiceId": "alloy",
  "outputFormat": "mp3"
}
```

### `POST /api/voice/recognize`
Request:
```json
{
  "audioData": "<base64>",
  "audioFormat": "mp3",
  "language": "en-US"
}
```

## Supported Formats

Synthesis output (`outputFormat`):
- `mp3`, `wav`, `ogg`, `flac`, `m4a`, `opus`, `pcm`

Recognition input (`audioFormat`):
- `wav`, `mp3`, `m4a`, `flac`, `ogg`, `webm`

Intentional behavior:
- `opus` and `pcm` are not accepted for STT and return `400`.

## Security and Validation

- Voice routes require bearer token middleware.
- Voice endpoints are excluded from generic cache middleware.
- Oversized payloads are rejected:
  - text too long -> `413`
  - audio payload too large -> `413`
- Malformed base64 -> `400`
- Invalid OpenAI key -> `401`

## Testing

Canonical runner:
- `scripts/voice-tests-1-8.mjs`

NPM commands:
- `npm run test:voice:1-8`
- `npm run test:voice:1-8:local`
- `npm run test:voice:1-8:report`

Report artifacts:
- `/tmp/voice-tests-1-8-latest.json`
- `docs/VOICE-TESTS-1-8-LATEST.md`

Legacy wrapper (kept for compatibility):
- `scripts/testing/test-voice-api.sh` (delegates to canonical runner)

## Troubleshooting

1. `401` on synthesis with custom key:
   - verify `x-openai-api-key` is valid
   - ensure request is not reusing stale/generated test payload assumptions
2. `400` recognition errors:
   - confirm `audioFormat` is supported
   - verify base64 input is valid
3. Telemetry missing:
   - check `/api/analytics/ai/summary` after one synth+recognize sequence
4. Route auth mismatch:
   - confirm bearer header presence and auth flags (`DISABLE_AUTH`, JWT config)

## Related Docs

- `docs/VOICE-API-ARCHITECTURE.md`
- `docs/VOICE-API-INTEGRATION-SUMMARY.md`
- `docs/VOICE-TESTS-1-8-LATEST.md`
- `docs/SUPPORT.md`
