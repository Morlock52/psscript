# AI Functions Review, Fixes, and Hosted Test Report

**Date:** April 27, 2026  
**Production target:** https://pstest.morloksmaze.com  
**Netlify site:** `psscript` / `a6cb54b5-b3f7-4f01-a756-70b127f07e19`  
**Supabase project:** `picxiqcekyfgjlrknfds`  
**Admin account under test:** `morlok52@gmail.com`

## Scope

This pass focused on the hosted Netlify application and the AI features that users can reach from production:

- Chat Assistant
- Agentic Assistant
- AI Agents / Agent Orchestration chat
- PowerShell script generation, explanation, and analysis
- AI examples routes
- Voice settings, speech synthesis, and speech recognition routes
- AI analytics summary, metrics, and budget alert routes
- Documentation AI crawl/summarization routes where hosted AI calls are used

The goal was pragmatic hosted parity first. I did not rebuild the legacy full `/api/agents` thread/run backend because the current production need is a working AI chat surface through Netlify Functions.

## External Sources Used

- OpenAI latest model and Responses API guidance: https://developers.openai.com/api/docs/guides/latest-model
- OpenAI Structured Outputs guidance for `text.format` / JSON schema responses: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI streaming Responses events guidance: https://developers.openai.com/api/docs/guides/streaming-responses#read-the-responses
- OpenAI text-to-speech voice options: https://developers.openai.com/api/docs/guides/text-to-speech#voice-options
- Netlify Functions docs: https://docs.netlify.com/functions/get-started/
- Netlify Functions API docs: https://docs.netlify.com/build/functions/api/
- OWASP SSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

## Review Method

- Used Netlify plugin tooling to confirm the active site and production deploy state.
- Used Computer Use to inspect the production browser session at `https://pstest.morloksmaze.com/ai/agents`.
- Used local code search and focused tests to map active frontend calls.
- Used two delegated review agents:
  - Backend AI route review for Netlify Function behavior, security, and observability.
  - Frontend AI workflow review for active browser flows, legacy route usage, and error handling.
- Used official OpenAI, Netlify, and OWASP documentation for implementation direction.

## Hosted AI Route Matrix

| Area | Route | Expected hosted behavior |
| --- | --- | --- |
| Chat | `POST /api/chat` | Authenticated PowerShell assistant response through server-side provider keys |
| Chat streaming | `POST /api/chat/stream` | Authenticated SSE stream using OpenAI Responses streaming when available |
| Script assistant | `POST /api/scripts/please` | Authenticated assistant response via Netlify Function |
| Script assistant alias | `POST /api/ai-agent/please` | Same behavior as `/scripts/please` |
| Script generation | `POST /api/scripts/generate` | Authenticated PowerShell script generation |
| Script generation alias | `POST /api/ai-agent/generate` | Same behavior as `/scripts/generate` |
| Script explanation | `POST /api/scripts/explain` | Authenticated simple/detailed/security explanations |
| Script explanation alias | `POST /api/ai-agent/explain` | Same behavior as `/scripts/explain` |
| Script analysis | `POST /api/scripts/analyze/assistant` | Authenticated structured PowerShell analysis |
| Script analysis alias | `POST /api/ai-agent/analyze/assistant` | Same behavior as `/scripts/analyze/assistant` |
| Examples | `GET /api/scripts/examples` | Authenticated example prompts/scripts |
| Examples alias | `GET /api/ai-agent/examples` | Same behavior as `/scripts/examples` |
| AI analytics | `GET /api/analytics/ai` | Authenticated metrics list or stable empty response |
| AI analytics summary | `GET /api/analytics/ai/summary` | Authenticated zero-safe summary instead of 404/500 |
| AI budget alerts | `GET /api/analytics/ai/budget-alerts` | Authenticated alert list or stable empty response |
| Voice list | `GET /api/voice/voices` | Authenticated voice list using hosted OpenAI-compatible options |
| Voice settings | `GET /api/voice/settings` | Authenticated voice settings response |
| Voice synthesis | `POST /api/voice/synthesize` | Authenticated server-side TTS call |
| Voice recognition | `POST /api/voice/recognize` | Authenticated server-side speech recognition call |

## Findings Fixed

### 1. Saved analysis access could cross user boundaries

**Risk:** `GET /scripts/:id/analysis` read saved `script_analysis` rows by script id without first proving the authenticated user could access the script.  
**Fix:** The route now calls `fetchScriptForUser(id, user.id)` before reading analysis data.

### 2. Documentation AI import had SSRF gaps

**Risk:** The hosted documentation crawler accepted user-supplied URLs, followed redirects automatically, and did not fully reject private/link-local/internal network targets.  
**Fix:** URL validation is now DNS-aware, rejects unsafe hostnames and private IP ranges, and follows redirects manually only after re-validating each redirected URL.

### 3. Voice and documentation AI calls were not consistently observable

**Risk:** TTS, speech recognition, and documentation AI summaries could call providers without recording AI metrics.  
**Fix:** These routes now record `ai_metrics` best-effort on success and failure without blocking user responses if metric writes fail.

### 4. `/chat/stream` was not truly streaming

**Risk:** The endpoint waited for a full completion and emitted a single SSE token, so production UI could not benefit from incremental streaming.  
**Fix:** Added `streamText(...)` using OpenAI Responses streaming events and emitting `response.output_text.delta` as SSE `token` events. Anthropic remains a fallback as a single response if OpenAI streaming fails.

### 5. Agentic Assistant follow-up questions did not submit

**Risk:** "Ask AI Assistant" on the agentic page switched tabs and claimed the question was sent, but it did not actually call the assistant.  
**Fix:** The page now carries a pending question into `PleaseMethodAgent`, which submits it after tab switch.

### 6. Chat "save generated script" was mock-only

**Risk:** Saved scripts from the Chat Assistant were routed to a mock upload function and could navigate to nonexistent script IDs.  
**Fix:** `scriptService.uploadScript` now posts to the hosted `/api/scripts` route in production and only uses the mock path in mock/dev mode.

### 7. AI Agent client error handling lost useful status data

**Risk:** `apiClient` rejects normalized service errors, but `aiAgent` handled mostly Axios errors, hiding status/retry information.  
**Fix:** `handleApiError` now preserves normalized `status`, `code`, `details`, retryability, and user-facing auth/rate-limit/server messages.

### 8. Generated script extraction was too brittle

**Risk:** The editor only loaded generated scripts for narrow prompts and exact code fences.  
**Fix:** Script generation detection and extraction now handles `powershell`, `ps1`, `pwsh`, unlabeled fences, mixed case, and PowerShell-like raw output.

## Key Files Changed

| File | Purpose |
| --- | --- |
| `netlify/functions/api.ts` | Hosted AI route parity, analysis authorization, SSRF hardening, voice/docs metrics, real chat streaming |
| `src/frontend/src/api/aiAgent.ts` | Production AI error normalization |
| `src/frontend/src/components/Agentic/PleaseMethodAgent.tsx` | Pending question submission and generated script extraction |
| `src/frontend/src/pages/AgenticAIPage.tsx` | Agentic follow-up handoff into assistant chat |
| `src/frontend/src/services/api-simple.ts` | Real production script upload from chat |
| `src/frontend/src/api/__tests__/hostedAiClient.test.ts` | Focused tests for hosted AI routing, server-only keys, SSRF protections, streaming, and follow-up behavior |

There are additional local OAuth/login and production agent UI changes already present in the worktree from the earlier hosted auth/AI work. I left unrelated artifacts alone, including the untracked `deno.lock`.

## Verification Commands

| Check | Result |
| --- | --- |
| `npm run test:run -- src/api/__tests__/hostedAiClient.test.ts --pool=threads --maxWorkers=1` from `src/frontend` | Passed, 6 tests |
| `npx tsc --noEmit --pretty false` from `src/frontend` | Passed |
| `npx netlify build` | Passed build and function bundling; local Lighthouse document request 404 did not fail the command |
| `npm run test:run -- --pool=threads --maxWorkers=1` from `src/frontend` | Passed, 42 tests |
| `npm test -- --runInBand src/routes/__tests__/analytics-ai.test.ts src/middleware/__tests__/aiAnalytics.test.ts src/services/__tests__/documentationAnalysis.test.ts src/controllers/script/__tests__/analysis.test.ts` from `src/backend` | Passed, 13 tests |
| `git diff --check` | Passed before deploy; should be re-run after this report |

## Hosted Production Verification

Production deploy completed with Netlify CLI:

- Production URL: https://pstest.morloksmaze.com
- Deploy URL: https://69efe2d9eb552c3ef21786ee--psscript.netlify.app
- Deploy logs: https://app.netlify.com/projects/psscript/deploys/69efe2d9eb552c3ef21786ee
- Function logs: https://app.netlify.com/projects/psscript/logs/functions
- Netlify deploy state from plugin: `ready`
- Function runtime: `nodejs22.x`
- Function routes: `/api`, `/api/*`

Unauthenticated hosted probes after deploy:

| Route | Status |
| --- | --- |
| `/api/health` | 200 |
| `/api/scripts/please` | 401 |
| `/api/scripts/generate` | 401 |
| `/api/scripts/explain` | 401 |
| `/api/scripts/analyze/assistant` | 401 |
| `/api/scripts/examples?description=services` | 401 |
| `/api/chat` | 401 |
| `/api/chat/stream` | 401 |
| `/api/voice/voices` | 401 |
| `/api/voice/settings` | 401 |
| `/api/analytics/ai` | 401 |
| `/api/analytics/ai/summary` | 401 |
| `/api/analytics/ai/budget-alerts` | 401 |

These 401 responses are expected without a bearer token and prove the deployed routes exist behind authentication rather than returning 404 or 500.

Computer Use browser inspection confirmed the production app is logged in at `/ai/agents`, the Agent chat page loads, Voice Copilot opens, and the visible prompt "Give one safe PowerShell command to list stopped services." has an AI answer rendered in the chat.

## Current Residual Risks

1. Authenticated API probes still need a bearer token for direct `curl` verification of 200 responses on every AI route. I verified route existence and auth gating without extracting the user's browser token.
2. Netlify Lighthouse performance remains poor on production (`Performance: 18`) because of existing frontend bundle size and render cost. This needs a separate performance/code-splitting pass.
3. Vite still reports large chunks during production build. This is related to the Lighthouse performance issue.
4. `src/frontend/src/api/agentOrchestrator.ts` still contains the legacy `/api/agents` client, but active production Agent UI files no longer import its runtime functions. The remaining imports are type-only.
5. Voice settings are currently returned by the hosted API but are not persisted as durable user preferences.
6. Some older `api-simple` helper methods still point at legacy AI operation names for less-used flows. I did not remove them because the current production pages covered by this pass do not call them.
7. `deno.lock` is still untracked and was not removed because it existed outside this AI fix scope.

## Follow-Up Plan

| Priority | Task | Verify |
| --- | --- | --- |
| P1 | Add authenticated hosted probes that use a test bearer token for all AI routes | Each route returns expected 200/4xx validation response, never 404/500 |
| P1 | Add Netlify Function tests for script analysis ownership and documentation SSRF rejection | Tests cover private IPs, localhost, redirects, and unauthorized script analysis |
| P2 | Split heavy frontend chunks and profile first load | Netlify Lighthouse performance improves materially |
| P2 | Remove or isolate unused legacy `agentOrchestrator` runtime functions | `rg "/api/agents"` only finds archived/docs/test references or no production bundle code |
| P2 | Persist voice settings per user | Settings survive reload and new session |
| P3 | Replace remaining legacy `api-simple` AI helper methods or prove they are dead code | Static search and focused UI tests show no broken production workflows |

## Conclusion

The hosted Netlify AI surface is now deployed with the missing route parity, safer hosted AI operations, better observability, real chat streaming, working agent follow-up behavior, and production script saving. The main remaining gap is authenticated end-to-end probing with a safe test token; without that token, direct hosted probes can only verify route existence and auth gating.
