# PSScript QA Issue Log

Run started: 2026-04-24T17:10:00Z

Scope:
- Current Netlify preview and local frontend.
- Hosted Netlify/Supabase/OpenAI path.
- Browser-visible behavior, API smoke tests, and auth-gated AI/voice endpoints.

Findings will be recorded with concrete reproduction evidence only.

## Findings

### ISSUE-001: Netlify preview is not fully usable because Supabase runtime env is missing

Evidence:
- `GET https://69eba36b45d114228806ba74--psscript.netlify.app/api/health` returns `200` with `status: "degraded"`.
- Response env flags: `database: false`, `supabaseUrl: false`, `supabaseAnonKey: false`, `supabaseServiceRoleKey: false`, while `openai: true`, `anthropic: true`.
- Auth-gated endpoints correctly return `401`, but no valid Supabase session can be created from the deployed app without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Impact:
- Login/register cannot create a real hosted session.
- Chat, analysis, voice, scripts, dashboard, and upload cannot be tested end-to-end because all require auth.

Status:
- Fixed UI behavior during this run by blocking hosted login/register when Vite Supabase env is absent and showing exact Netlify env keys needed.

### ISSUE-002: Frontend chat could silently use mock responses instead of hosted AI

Evidence:
- `src/frontend/src/hooks/useChat.tsx` imports `../services/api-simple`.
- Prior `api-simple` implementation posted to `/api/chat` without `Authorization`.
- Prior `api-simple` caught backend errors and returned local mock PowerShell responses in production.

Impact:
- Users could see fake “AI” answers even when OpenAI/Anthropic or auth failed.
- Production failures would be hidden from QA.

Status:
- Fixed during this run by adding auth headers, disabling production mock fallback, and surfacing backend error messages.

### ISSUE-003: Frontend streaming chat route existed without a hosted Netlify implementation

Evidence:
- `src/frontend/src/services/api-simple.ts` calls `POST /api/chat/stream`.
- Previous Netlify route table handled `/chat` and `/chat/message`, but not `/chat/stream`.

Impact:
- Streaming chat UX would fail once enabled.

Status:
- Fixed during this run by adding a same-origin SSE-compatible `/api/chat/stream` route.

### ISSUE-004: Local AI chat UI times out through the legacy Python AI-service proxy

Evidence:
- Computer Use test on `http://127.0.0.1:3191/login` clicked `Use Default Login` and reached the authenticated dashboard.
- Computer Use test on `http://127.0.0.1:3191/chat` submitted `Write a safe PowerShell command to list running services.`
- The browser stayed in `Sending...`.
- Direct API reproduction: `POST http://127.0.0.1:3191/api/chat` returned `504` with `{"error":"Request timeout","details":"The AI service took too long to respond. Please try again with a simpler query."}`.
- `lsof -nP -iTCP:4000 -sTCP:LISTEN` shows the active backend is a Docker-published service, so the browser is currently exercising the old container.

Impact:
- Local AI chat is not usable until the backend container picks up the source fix.
- This affects AI chat specifically; dashboard/auth/local health are working.

Status:
- Fixed in source by changing `src/backend/src/controllers/ChatController.ts` to call OpenAI/Anthropic SDKs directly instead of proxying chat and chat-stream requests through the legacy Python AI service.
- Also applied the same fix to the source mounted by the running Docker app at `/Users/morlock/fun/02_PowerShell_Projects/psscript/src/backend/src/controllers/ChatController.ts`.
- Retested after backend restart: direct `POST https://127.0.0.1:4000/api/chat` returned `200` with provider `openai` and model `gpt-4.1-mini`.
- Retested in Computer Use: `http://127.0.0.1:3191/chat` answered `Give one short command to list stopped services.` with `Get-Service | Where-Object Status -eq 'Stopped'`.

## Fix Plan Reviewed And Applied

Global solution:
- Use Supabase Auth as the only hosted authentication path, matching the Supabase React/Vite guidance that browser auth uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Keep server-only secrets in Netlify runtime environment variables, matching Netlify environment-variable guidance.
- Keep AI behind authenticated same-origin Netlify Functions so OpenAI/Anthropic keys never enter browser storage.
- Fail visibly when hosted auth is not configured instead of falling back to legacy local auth or mock AI.

Implemented:
- Login/register now show a hosted-auth setup warning when Vite Supabase env vars are missing on a remote deploy.
- Login/register submit and demo-login buttons are disabled when hosted auth is missing.
- Active chat service sends bearer auth headers to `/api/chat`.
- Active chat service no longer silently returns mock responses in production.
- Netlify Functions now provide `/api/chat/stream` for the existing frontend streaming path.

Retest:
- `npm run build:netlify` passed.
- `git diff --check` passed.
- Latest preview: `https://69eba7ef31e14437e96274ab--psscript.netlify.app`.
- `GET /api/health` returns `200` degraded with OpenAI/Anthropic configured and Supabase/DB missing.
- Browser snapshot confirms login page displays `Hosted auth is not configured.` and disables both `Sign in` and `Use Default Login`.
- Computer Use local retest confirms default login reaches the dashboard and `/api/health` returns local database/cache connected.
- Computer Use local AI chat test reproduced ISSUE-004, then passed after patching the Docker-mounted source and restarting `psscript-backend-1`.
