# API Issue Review (Requested as of 02/26)

## Scope
- Reviewed backend and frontend API call paths in `src/backend/src` and `src/frontend/src`, plus legacy voice UI components under `src/frontend/components`.
- Reviewed current runtime logs in `logs/combined.log` and `logs/error.log`.
- Cross-checked Chat Completions request/response contracts from OpenAI docs and axios interceptor behavior from official axios docs.

## Current Findings from Logs
- DB connectivity failures are active in runtime logs:
  - `SequelizeConnectionRefusedError` and `SequelizeConnectionError` with `ECONNREFUSED` in `logs/combined.log` and `logs/error.log`.
  - Additional network diagnostics failure: `getaddrinfo ENOTFOUND non-existent-host.local`.
- No chat-route 404 or voice-route 404 entries were present in the latest combined log tail, and TS route mount for `/api/voice` was previously disabled in source.

## Fixes Applied
1. Backend chat compatibility
   - File: `src/backend/src/controllers/ChatController.ts`
   - Added legacy payload support: accepts `{ message: string }` and converts to a `messages` array when `messages` is missing.
   - Added response compatibility: responses now include both `response` and `text` fields for older clients.

2. Frontend chat-message mismatch
   - File: `src/frontend/components/VoiceChatInterface.jsx`
   - Fixed payload shape sent to `/api/chat/message` from `{ message }` to `messages: [{ role: 'user', content } ]`.
   - Read assistant reply from `response.data.response` with fallback to `response.data.text`.

3. Voice API hardening in legacy UI components
   - Files: `src/frontend/components/VoiceSettings.jsx`, `VoicePlayback.jsx`, `VoiceRecorder.jsx`
   - Added targeted handling for 404 voice-endpoint failures to avoid hard-failing UI when `/api/voice/*` is not mounted.

4. Docs update
   - File: `README.md`
   - Updated AI operations to current chat endpoints (`/api/chat`, `/api/chat/search`) and note legacy compatibility endpoint (`/scripts/please`).

5. Voice endpoint wiring in TypeScript backend
   - File: `src/backend/src/routes/voice.ts`
   - Created new route wiring for:
     - `POST /api/voice/synthesize`
     - `POST /api/voice/recognize`
     - `GET /api/voice/voices`
     - `GET /api/voice/settings`
     - `PUT /api/voice/settings`
   - Routes now use `authenticateJWT` and are mounted through the main TS app entrypoint.
   - File: `src/backend/src/index.ts`
   - Added `voiceRoutes` import and mounted at `app.use('/api/voice', voiceRoutes)`.
   - Added AI rate limiting for `/api/voice` to match chat/assistant behavior.

## Internet Research Notes
- OpenAI chat completions require an array of role/content messages in request payload; this confirms the backend contract we align to.
- axios interceptors remain the right place for runtime URL and auth header injection, but direct `axios.*` calls may bypass that behavior unless manually managed.
- Sources: [OpenAI Chat Completions Docs](https://platform.openai.com/docs/api-reference/chat/object), [Axios Interceptors Docs](https://axios-http.com/docs/interceptors).

## Latest API Cleanup and Validation Notes (2026-02-12)
- Weather and Alpha Vantage API integrations were fully removed from runtime code paths:
  - `src/frontend/src/pages/Settings/ApiSettings.tsx`
  - `src/ai/config.py`
  - `src/ai/agents/langchain_agent.py`
  - `src/ai/agents/_archive/langchain_agent.py`
- Source scan now returns no references to `OPENWEATHER_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `VITE_WEATHER_API_KEY`, or `VITE_ALPHA_VANTAGE_API_KEY`.
- Backend/AI/frontend endpoint smoke checks during the 2026-02-12 window returned HTTP 200 for:
  - `https://127.0.0.1:4000/api/health`
  - `http://127.0.0.1:8000/health`
  - `https://127.0.0.1:3090`
- Crawl/card regression script (`logs/manual-tests/crawl-card-test.sh`) was run and:
  - Async job creation succeeded and returned a jobId.
  - Synchronous crawl (`POST /api/documentation/crawl/ai`) completed successfully with `success: true`.
  - A persisted doc record was confirmed with card-friendly fields.
- Residual note: the async job status polling can remain `running` while the backend is restarted/stopped in the current local session; rerun the script against a stable service session for deterministic `completed` status.

## Next API cleanup steps (recommended)
- Run an end-to-end check for `/api/voice/*` with backend + AI service running (record audio/text roundtrip).
- Add an integration test for `/api/voice/settings` and `/api/voice/synthesize`.
- Move any remaining infrastructure failures (database/service discovery) into operational runbooks after the API contract is stable.

## Crawl + Document Card Generation Validation (2026-02-12)

- Performed targeted backend + UI validation for documentation crawling and card rendering using local services (`frontend` on `https://127.0.0.1:3090`, `backend` on `https://127.0.0.1:4000`, `ai` on `http://127.0.0.1:8000`).
- Log output captured in:
  - `logs/manual-tests/crawl-card-test.log`
  - `logs/manual-tests/crawl-complete.png`
  - `logs/manual-tests/documentation-after-crawl.png`

### API checks executed
- `GET /api/documentation/stats` -> `success: true`
- `GET /api/documentation/sources` -> `success: true`
- `GET /api/documentation/tags` -> `success: true`
- `GET /api/documentation?limit=5` -> `success: true`
- `POST /api/documentation/crawl/ai/jobs` with `https://example.com`, `maxPages:1`, `depth:0`:
  - Job transitioned to `completed`.
  - Job result returned `pagesProcessed:1`, `totalPages:1`, `scriptsFound:0`, saved docs with `id/title/url/source`.
- `GET /api/documentation/1` returned a persisted row with required card fields (`id`, `title`, `summary`, `source`, `tags`, `metadata`).
- `POST /api/documentation/crawl/ai` with same payload completed successfully after extending timeout (`~30s`) and returned `success: true`.

### UI checks executed
- Playwright flow: login handling, open `/documentation/crawl`, submit import, wait for `Import Completed`, open `/documentation`.
- Verified at least one `article` card renders and card body includes Summary/Added sections.
- Evidence captured in `logs/manual-tests/documentation-after-crawl.png` (card rendering present).

### Known runtime notes
- First UI test attempt used a strict locator on duplicated “Import in Progress” text and failed; reran with a robust locator and passed.
- Insecure HTTPS warning noise occurs when using Python `requests` against `https://127.0.0.1:4000` without CA verification.
