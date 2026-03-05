# Voice API Architecture

Current architecture for voice processing (February 14, 2026).

## System Layout

```text
Frontend (React voice components)
  -> Backend (Express voice routes/controller)
    -> AI Service (FastAPI voice endpoints/service)
      -> OpenAI TTS/STT APIs
```

## Components

Frontend:
- `src/frontend/components/VoiceChatInterface.jsx`
- `src/frontend/components/VoiceRecorder.jsx`
- `src/frontend/components/VoicePlayback.jsx`
- `src/frontend/components/VoiceSettings.jsx`

Backend:
- `src/backend/src/routes/voice.ts`
- `src/backend/src/controllers/VoiceController.ts`
- `src/backend/src/index.ts` (cache skip integration)

AI service:
- `src/ai/voice_endpoints.py`
- `src/ai/voice_service.py`

## Request Flow

### Synthesis

1. Client calls `POST /api/voice/synthesize`.
2. Backend validates text length, voice, and output format.
3. Backend forwards to AI service with optional `x-openai-api-key`.
4. AI service performs OpenAI TTS and applies scoped caching.
5. Audio payload returns to client.

### Recognition

1. Client calls `POST /api/voice/recognize`.
2. Backend validates base64 size and input format.
3. Backend forwards `audio_format` + payload to AI service.
4. AI service decodes/validates input and performs OpenAI STT.
5. Transcript returns to client.

## Security Controls

- Voice route bearer-token enforcement in route middleware.
- Request size limits in backend controller.
- Error code preservation (400/401/413 are not collapsed to 500).
- Voice routes excluded from generic response-cache middleware.
- API-key-scoped cache keys in AI service to avoid cross-key contamination.

## Observability

- Voice endpoints write AI metrics for:
  - `/api/voice/synthesize`
  - `/api/voice/recognize`
- `GET /api/analytics/ai/summary` should surface both endpoints after traffic.

## Known Constraints

- STT accepts `wav`, `mp3`, `m4a`, `flac`, `ogg`, `webm`.
- STT intentionally rejects `opus` and `pcm` with `400`.
