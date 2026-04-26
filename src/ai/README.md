# AI Service

FastAPI-based AI service for PowerShell analysis, embeddings, LangGraph orchestration, and OpenAI-backed voice/listening workflows.

## Canonical local target

- Base URL: `http://127.0.0.1:8000`
- Backend peer: `https://127.0.0.1:4000`
- Validation date: April 26, 2026

## Current responsibilities

- PowerShell script analysis and scoring
- Embedding generation for semantic search
- LangGraph orchestration and tool execution
- Voice synthesis and speech recognition
- Advanced listening features such as diarization, chunking, and speaker hints

## Current OpenAI defaults

These defaults were rechecked against official OpenAI docs on April 26, 2026.

- General chat/default hosted text: `gpt-5.5`
- Fast hosted analysis: `gpt-5.4-mini`
- PowerShell/code specialist fallback: `gpt-4.1`
- TTS: `gpt-4o-mini-tts`
- STT: `gpt-4o-mini-transcribe`
- Diarization: `gpt-4o-transcribe-diarize`
- Embeddings: `text-embedding-3-large`

Official references:
- [Voice agents guide](https://developers.openai.com/api/docs/guides/voice-agents/)
- [Audio transcription reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create/)
- [Audio speech reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create/)

## Current service behavior

- Runtime mock-mode fallbacks have been removed.
- Missing OpenAI configuration now fails explicitly instead of inventing synthetic analysis or chat results.
- LangGraph tool execution uses the real script-analysis path.
- Voice routes support OpenAI-based synthesis and recognition with advanced request options already wired through the service.
- The recommended chained path is `gpt-4o-mini-transcribe -> gpt-5.4-mini -> gpt-4o-mini-tts`.
- Silent audio is detected before transcription so silence returns empty text instead of fabricated words.
- Unknown voice service selections now fail explicitly instead of degrading to mock audio behavior.

## Local run

```bash
pip install -r requirements.txt
python main.py
```

## Validation

```bash
python test_langgraph_setup.py
```

Latest validated result on March 8, 2026:
- `5/5` checks passed

Voice is validated through the backend proxy using:

```bash
node ../../scripts/voice-tests-1-8.mjs --base-url https://127.0.0.1:4000 --insecure-tls
```

Latest voice result on March 8, 2026:
- `8/8` checks passed
