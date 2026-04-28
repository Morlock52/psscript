# Voice API Tests 1-8 Report (2026-02-14)

## Scope
Validated and hardened the OpenAI-based voice pipeline across:
- Python AI service (`/synthesize`, `/recognize`)
- Node backend voice controller/routes
- Auth, caching, payload validation, telemetry, and stress behavior

Test runner used:
- `/tmp/voice_test_runner.mjs`
- Latest execution date: **2026-02-14**

Raw result artifact:
- `/tmp/voice_test_results.json`

## Executive Result
All eight tests executed successfully against the current implementation.

- Critical failures: **0**
- Regressions: **0**
- Remaining intentional constraints: STT does not accept `opus`/`pcm` payloads (returns `400`)

## Test Results

### 1) Route and basic functional checks
- `GET /api/voice/voices`: `200`
- `GET /api/voice/settings`: `200`
- `POST /api/voice/synthesize`: `200` with audio payload
- `POST /api/voice/recognize`: `200` with transcript (`"Test one route."`)

Status: **PASS**

### 2) Load/stress checks (synthesize)
- Concurrency 10: 10/10 success, p95 ~218ms
- Concurrency 25: 25/25 success, p95 ~366ms
- Concurrency 50: 50/50 success, p95 ~528ms

Status: **PASS**

### 3) Format/voice matrix
Voices tested: `alloy`, `nova`, `cedar`
Formats tested: `mp3`, `wav`, `flac`, `opus`

- `mp3/wav/flac`: synth `200`, recognize `200`
- `opus`: synth `200`, recognize `400` (expected unsupported STT format)

Status: **PASS** (with documented format limitation)

### 4) Robustness tests
- Silence WAV: `200`, no transcript (expected)
- Random noise: `400` invalid/unsupported content (expected)
- Accent phrase: `200`, correct transcript
- Spanish phrase (`es-ES`): `200`, correct transcript

Status: **PASS**

### 5) Failure path validation
- Invalid API key: `401` (correct)
- Malformed base64 audio: `400` (correct)
- Missing text: `400` (correct)

Status: **PASS**

### 6) Cache behavior
- First synth request: ~1024ms
- Second synth request (same request): ~130ms
- Improvement observed: true

Status: **PASS**

### 7) Security checks
- Unauthenticated voices route: `401`
- Oversized text: `413`
- Oversized audio: `413`
- Prompt-injection-like synthesis input: `200` (returns audio, no crash)

Status: **PASS**

### 8) Telemetry checks
AI analytics summary now includes voice endpoints in top endpoint list:
- `/api/voice/synthesize`
- `/api/voice/recognize`

Status: **PASS**

## Issues Fixed During This Cycle

1. Invalid API key cache contamination risk
- Problem: cached synth responses could be reused across different API key contexts.
- Fix: include API key scope fingerprint in AI-service voice cache key generation.
- File: `src/ai/voice_service.py`

2. HTTP error semantics were being flattened to 500 in some paths
- Problem: expected 4xx errors (bad base64, unsupported format, invalid key) could be masked.
- Fix: preserve `HTTPException` and rethrow in service/endpoint layers.
- Files:
  - `src/ai/voice_service.py`
  - `src/ai/voice_endpoints.py`

3. STT format handling and clearer validation
- Problem: unsupported transcription formats could surface as opaque failures.
- Fix: added request `audio_format` passthrough and explicit rejection (`400`) for unsupported formats.
- Files:
  - `src/ai/voice_endpoints.py`
  - `src/backend/src/controllers/VoiceController.ts`

4. Voice route auth hardening
- Problem: development auth bypass configurations could expose route behavior too broadly.
- Fix: enforced bearer token presence middleware on voice routes.
- File: `src/backend/src/routes/voice.ts`

5. Cache middleware exposure for voice routes
- Problem: GET response caching for voice endpoints could serve stale/auth-dependent responses.
- Fix: added `/api/voice` to backend cache skip list.
- File: `src/backend/src/index.ts`

6. Input size guardrails for abuse resistance
- Problem: no strict upper bounds on text/audio payload size for voice operations.
- Fix: enforce text/audio limits and return `413` for oversized payloads.
- File: `src/backend/src/controllers/VoiceController.ts`

7. OpenAI voice defaults + catalog alignment
- Problem: mixed provider-era defaults could create mismatched voice IDs.
- Fix: OpenAI voice catalog and default voice alignment across backend/frontend.
- Files:
  - `src/backend/src/controllers/VoiceController.ts`
  - `src/frontend/components/VoiceChatInterface.jsx`

8. Voice telemetry visibility gap
- Problem: voice activity was not clearly represented in AI analytics.
- Fix: added explicit AI metric writes for synth/recognize endpoints.
- File: `src/backend/src/controllers/VoiceController.ts`

## Current Known Limitations
- `opus` (and raw `pcm`) are not accepted for current STT flow and intentionally return `400`.
- Noise-only payloads may return provider-level `400 unsupported_format`, which is propagated as client error by design.

## Verification Commands
```bash
# Run full voice 1-8 suite
node /tmp/voice_test_runner.mjs

# Optional: inspect latest JSON artifact
cat /tmp/voice_test_results.json
```
