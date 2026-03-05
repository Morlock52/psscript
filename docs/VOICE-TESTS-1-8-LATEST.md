# Voice API Tests 1-8 (Automated)

Run date: 2026-02-14T20:00:47.957Z
Base URL: https://127.0.0.1:4000

## Summary
- Passed checks: 8/8
- Failed checks: 0

- PASS test1: Core route checks
- PASS test2: Concurrency/load success
- PASS test3: Format matrix behavior
- PASS test4: Robustness behavior
- PASS test5: Failure-path status codes
- PASS test6: Cache improves repeat latency
- PASS test7: Security guardrails
- PASS test8: Telemetry captures voice endpoints

## Raw Results
```json
[
  {
    "k": "test1_route",
    "name": "voices",
    "status": 200,
    "duration": 49
  },
  {
    "k": "test1_route",
    "name": "settings_get",
    "status": 200,
    "duration": 21
  },
  {
    "k": "test1_route",
    "name": "synthesize",
    "status": 200,
    "duration": 234,
    "hasAudio": true
  },
  {
    "k": "test1_route",
    "name": "recognize",
    "status": 200,
    "duration": 786,
    "text": "Test one route."
  },
  {
    "k": "test2_load",
    "endpoint": "synthesize",
    "concurrency": 10,
    "ok": 10,
    "total": 10,
    "fail": 0,
    "p50": 754,
    "p95": 763,
    "max": 763
  },
  {
    "k": "test2_load",
    "endpoint": "synthesize",
    "concurrency": 25,
    "ok": 25,
    "total": 25,
    "fail": 0,
    "p50": 1729,
    "p95": 1812,
    "max": 1983
  },
  {
    "k": "test2_load",
    "endpoint": "synthesize",
    "concurrency": 50,
    "ok": 50,
    "total": 50,
    "fail": 0,
    "p50": 2119,
    "p95": 2839,
    "max": 2840
  },
  {
    "k": "test3_matrix",
    "voice": "alloy",
    "format": "mp3",
    "synthesize": 200,
    "recognize": 200
  },
  {
    "k": "test3_matrix",
    "voice": "alloy",
    "format": "wav",
    "synthesize": 200,
    "recognize": 200
  },
  {
    "k": "test3_matrix",
    "voice": "alloy",
    "format": "flac",
    "synthesize": 200,
    "recognize": 200
  },
  {
    "k": "test3_matrix",
    "voice": "alloy",
    "format": "opus",
    "synthesize": 200,
    "recognize": 400
  },
  {
    "k": "test3_matrix",
    "voice": "nova",
    "format": "mp3",
    "synthesize": 200,
    "recognize": 200
  },
  {
    "k": "test3_matrix",
    "voice": "nova",
    "format": "wav",
    "synthesize": 200,
    "recognize": 200
  },
  {
    "k": "test3_matrix",
    "voice": "nova",
    "format": "flac",
    "synthesize": 200,
    "recognize": 200
  },
  {
    "k": "test3_matrix",
    "voice": "nova",
    "format": "opus",
    "synthesize": 200,
    "recognize": 400
  },
  {
    "k": "test3_matrix",
    "voice": "cedar",
    "format": "mp3",
    "synthesize": 200,
    "recognize": 200
  },
  {
    "k": "test3_matrix",
    "voice": "cedar",
    "format": "wav",
    "synthesize": 200,
    "recognize": 200
  },
  {
    "k": "test3_matrix",
    "voice": "cedar",
    "format": "flac",
    "synthesize": 200,
    "recognize": 200
  },
  {
    "k": "test3_matrix",
    "voice": "cedar",
    "format": "opus",
    "synthesize": 200,
    "recognize": 400
  },
  {
    "k": "test4_robust",
    "case": "silence_wav",
    "status": 200,
    "text": null,
    "error": null
  },
  {
    "k": "test4_robust",
    "case": "noise_random",
    "status": 400,
    "error": "Invalid or unsupported audio content: Error code: 400 - {'error': {'message': 'This model does not support the format you provided.', 'type': 'invalid_request_error', 'param': 'messages', 'code': 'unsupported_format'}}"
  },
  {
    "k": "test4_robust",
    "case": "accent_phrase",
    "status": 200,
    "text": "Schedule the route for tomorrow at quarter past nine."
  },
  {
    "k": "test4_robust",
    "case": "spanish",
    "status": 200,
    "text": "Hola, esta es una prueba de reconocimiento de voz."
  },
  {
    "k": "test5_failure",
    "case": "invalid_api_key",
    "status": 401,
    "error": "OpenAI TTS error: Error code: 401 - {'error': {'message': 'Incorrect API key provided: sk-invalid. You can find your API key at https://platform.openai.com/account/api-keys.', 'type': 'invalid_request_error', 'code': 'invalid_api_key', 'param': None}, 'status': 401}"
  },
  {
    "k": "test5_failure",
    "case": "malformed_base64",
    "status": 400,
    "error": "Invalid base64 audio data: Invalid base64-encoded string: number of data characters (9) cannot be 1 more than a multiple of 4"
  },
  {
    "k": "test5_failure",
    "case": "missing_text",
    "status": 400,
    "error": "Text is required"
  },
  {
    "k": "test6_cache",
    "first_ms": 59,
    "second_ms": 29,
    "improved": true,
    "status1": 200,
    "status2": 200
  },
  {
    "k": "test7_security",
    "case": "unauth_voices",
    "status": 401
  },
  {
    "k": "test7_security",
    "case": "oversized_text",
    "status": 413,
    "error": "Text too long; max 6000 characters"
  },
  {
    "k": "test7_security",
    "case": "oversized_audio",
    "status": 413,
    "error": "Audio payload too large; max 16000000 base64 chars"
  },
  {
    "k": "test7_security",
    "case": "prompt_injection_text",
    "status": 200,
    "hasAudio": true
  },
  {
    "k": "test8_telemetry",
    "before": 200,
    "after": 200,
    "topEndpoints": [
      "/api/voice/synthesize",
      "/api/voice/recognize"
    ]
  }
]
```
