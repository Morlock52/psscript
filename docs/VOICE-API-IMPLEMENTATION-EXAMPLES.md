# Voice API Implementation Examples

Current examples for the OpenAI-backed voice stack (February 14, 2026).

## 1) Synthesize speech

```bash
curl -k -X POST "https://127.0.0.1:4000/api/voice/synthesize" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Run diagnostics and summarize findings.",
    "voiceId": "alloy",
    "outputFormat": "mp3"
  }'
```

## 2) Recognize speech

```bash
curl -k -X POST "https://127.0.0.1:4000/api/voice/recognize" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "audioData": "<base64-audio>",
    "audioFormat": "mp3",
    "language": "en-US"
  }'
```

## 3) Per-request OpenAI key override

```bash
curl -k -X POST "https://127.0.0.1:4000/api/voice/synthesize" \
  -H "Authorization: Bearer <JWT>" \
  -H "x-openai-api-key: sk-..." \
  -H "Content-Type: application/json" \
  -d '{"text":"override key test","voiceId":"alloy","outputFormat":"mp3"}'
```

## 4) Frontend service call (JS)

```javascript
const response = await fetch('/api/voice/synthesize', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: userText,
    voiceId: 'alloy',
    outputFormat: 'mp3'
  })
});

const data = await response.json();
if (!response.ok) throw new Error(data.error || 'Voice synth failed');
```

## 5) Validation examples

```bash
# full local run
npm run test:voice:1-8:local

# full run + report artifacts
npm run test:voice:1-8:report
```

Artifacts:
- `/tmp/voice-tests-1-8-latest.json`
- `docs/VOICE-TESTS-1-8-LATEST.md`
