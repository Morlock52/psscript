# Voice API

This is the canonical guide for voice features in PSScript as of March 8, 2026.

## Current status

- Provider: OpenAI for both TTS and STT
- Backend routes: `/api/voice/*`
- AI service routes: `POST /voice/synthesize`, `POST /voice/recognize`
- Default voice: `alloy`
- Default TTS model: `gpt-4o-mini-tts`
- Default STT model: `gpt-4o-transcribe`
- Advanced listening options: diarization, logprobs, chunking/VAD, and known speaker references
- Canonical validation runner: `scripts/voice-tests-1-8.mjs`

## Official OpenAI references

Verified on March 6, 2026:
- [Voice agents guide](https://developers.openai.com/api/docs/guides/voice-agents/)
- [Audio and speech guide](https://developers.openai.com/api/docs/guides/audio/)
- [Audio speech reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create/)
- [Audio transcription reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create/)

OpenAI currently documents:
- chained voice architecture: `gpt-4o-transcribe -> gpt-4.1 -> gpt-4o-mini-tts`
- transcription options including `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, and `gpt-4o-transcribe-diarize`

## Architecture

1. Frontend voice UI components call backend voice routes.
2. Backend `VoiceController` validates and forwards to the AI service.
3. AI service `voice_service.py` performs OpenAI TTS/STT.
4. Response returns to backend and then frontend.

Primary files:
- `src/backend/src/controllers/VoiceController.ts`
- `src/backend/src/routes/voice.ts`
- `src/ai/voice_endpoints.py`
- `src/ai/voice_service.py`

## Canonical runtime

- frontend peer: `https://127.0.0.1:3090`
- backend target: `https://127.0.0.1:4000`
- AI service target: `http://127.0.0.1:8000`

## Configuration

Required:
- `OPENAI_API_KEY` in the AI service environment

Common tuning:
- `VOICE_TTS_MODEL`
- `VOICE_STT_MODEL`
- `MAX_VOICE_TEXT_CHARS` (backend limit, default `6000`)
- `MAX_AUDIO_DATA_B64_CHARS` (backend limit, default `16000000`)

Per-request override:
- `x-openai-api-key` header

## Supported formats

Synthesis output (`outputFormat`):
- `mp3`, `wav`, `ogg`, `flac`, `m4a`, `opus`, `pcm`

Recognition input (`audioFormat`):
- `wav`, `mp3`, `m4a`, `flac`, `ogg`, `webm`

Intentional behavior:
- `opus` and `pcm` are not accepted for STT and return `400`

## Security and validation

- Voice routes require bearer-token auth unless auth is disabled locally.
- Voice routes are excluded from the generic cache middleware.
- Oversized payloads are rejected with `413`.
- Malformed base64 is rejected with `400`.
- Invalid OpenAI key is rejected with `401`.
- Backend-to-AI voice request timeouts are returned as `504`.
- Silent audio is short-circuited before transcription and returns empty text instead of hallucinated content.
- Unknown TTS or STT provider selection does not fall back to mock output.

## Validation

Canonical command:

```bash
node scripts/voice-tests-1-8.mjs --base-url https://127.0.0.1:4000 --insecure-tls
```

Report artifacts:
- `/tmp/voice-tests-1-8-latest.json`
- `docs/VOICE-TESTS-1-8-LATEST.md`

Latest validated result on March 8, 2026:
- `8/8` checks passed
