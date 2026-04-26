# Browser Use QA Plan and Results

Run date: 2026-04-24
Target: http://127.0.0.1:3191
Tooling: Browser Use in-app browser session

## Safety Rules

- Do not click destructive controls such as Delete, Clear history, Reset, or bulk delete unless the user confirms at action time.
- Do not accept microphone permissions during voice tests unless the user confirms at action time.
- Do not download or export watermarked media or video assets.
- Reversible UI controls, filters, tabs, menus, and theme switches may be tested and restored.
- File upload controls may be opened or verified, but no private local file should be uploaded unless a generated test fixture is explicitly used.

## Test Matrix

| ID | Area | Test | Expected Result | Browser Result | Issue |
| --- | --- | --- | --- | --- | --- |
| QA-001 | App health | Open `/api/health` through the app origin. | Health endpoint returns usable JSON and no browser error page. | Pass: returned status/database/cache JSON. | None |
| QA-002 | Auth/session | Open `/login`. | Login page renders, or an authenticated session redirects to the app. | Pass: seeded form login reached dashboard. | None |
| QA-003 | Global shell | Open `/dashboard`. | Sidebar, navbar, branded shell, dashboard heading, and voice button render. | Pass: shell, dashboard, and voice button rendered. | None |
| QA-004 | Navbar | Test global search input and notification/user/theme controls when visible. | Controls are visible, clickable when safe, and do not crash the page. | Pass: theme toggle worked; no global search input was present on the dashboard. | None |
| QA-005 | Sidebar | Click the AI Assistant menu disclosure. | AI submenu opens and links for Chat Assistant / Agentic Assistant are visible. | Pass on retest: submenu links visible. | Initial timing false negative; no code issue. |
| QA-006 | Dashboard | Verify dashboard cards and quick action links. | Stats/cards render; safe links navigate to intended app pages. | Pass on retest: stats, recent scripts, and quick actions visible. | Initial timing false negative; no code issue. |
| QA-007 | Analytics | Open `/analytics`. | Analytics page renders without runtime error. | Pass: analytics dashboard rendered. | None |
| QA-008 | Scripts list | Open `/scripts`; test search/filter controls if visible. | Script list or empty state renders; filters/search do not crash. | Pass: script management and filters rendered. | None |
| QA-009 | Script upload | Open `/scripts/upload`; inspect upload controls. | Upload page renders; file picker control is accessible. | Pass: upload form and category controls rendered. | None |
| QA-010 | Script detail/analysis | Navigate from a visible script card or use available detail/analysis links. | Detail and analysis views render, or no data state is clear. | Pass: `/scripts/1/analysis` rendered analysis tabs. | None |
| QA-011 | Chat render | Open `/chat`. | Dark PSScript AI chat shell renders with muted header colors. | Pass: chat shell and muted header rendered. | None |
| QA-012 | Chat send | Send a small PowerShell prompt. | Prompt appears, assistant response renders, Send disables while loading, no error toast. | Pass on retest: assistant answered the `Get-Process` prompt. | Initial selector used stale placeholder; no code issue. |
| QA-013 | Chat controls | Test Search toggle, History link, Upload Script button, and safe modal controls. | Reversible controls work; destructive Clear is skipped. | Pass: Search toggled and Upload/History controls were present; Clear skipped by safety rule. | None |
| QA-014 | Voice dock | Open Voice dock. | Voice Copilot panel opens; auth/permission requirements are explained; no crash. | Pass: Voice Copilot opened with Dictate/Speak controls and voice options. | Microphone permission not accepted by safety rule. |
| QA-015 | Chat history | Open `/chat/history`. | History page renders or empty state is clear; delete controls are skipped. | Pass: history/empty state rendered. | Delete skipped by safety rule. |
| QA-016 | Agentic assistant | Open `/ai/assistant`; test visible tabs/buttons that are safe. | Page renders and safe tabs/buttons work without crash. | Pass: agentic assistant page rendered. | None |
| QA-017 | Agent orchestration | Open `/ai/agents`. | Page renders or auth/empty state is clear. | Pass: agent orchestration page rendered. | None |
| QA-018 | Documentation | Open `/documentation`; test search/navigation controls if visible. | Documentation renders and safe controls respond. | Fixed, then pass: documentation page renders with default sources/tags and no new console errors. | Missing `documentation` table caused initial 500s. |
| QA-019 | Documentation crawl/data | Open `/documentation/crawl` and `/documentation/data`. | Pages render or protected/empty state is clear. | Fixed, then pass: crawl and library pages render. | Missing `documentation` table caused initial console/API errors. |
| QA-020 | UI components | Open `/ui-components`; test representative buttons/switches. | Demo controls render and reversible controls work. | Pass: UI components demo rendered. | None |
| QA-021 | Settings profile | Open `/settings/profile`. | Profile settings render without runtime error. | Pass: profile settings rendered. | None |
| QA-022 | Settings appearance | Open `/settings/appearance`; test reversible theme/display controls. | Controls toggle safely and the UI remains usable. | Pass: appearance controls rendered. | None |
| QA-023 | Settings security | Open `/settings/security`. | Security settings render; destructive/session-reset controls are skipped. | Pass: security settings rendered. | Password/session mutations skipped by safety rule. |
| QA-024 | Settings notifications | Open `/settings/notifications`; test reversible toggles only. | Notification toggles work; save action is skipped unless non-destructive. | Pass: notification settings rendered. | Save skipped to avoid mutating user settings. |
| QA-025 | Settings API/users/categories/data | Open `/settings/api`, `/settings/users`, `/settings/categories`, `/settings/data`. | Pages render or protected/admin states are clear; destructive actions skipped. | Pass: all settings pages rendered. | Add/delete/maintenance actions skipped by safety rule. |
| QA-026 | 404 route | Open an unknown route. | App shows the Not Found page or redirects to `/404` without a blank screen. | Pass: redirected to `/404` and displayed Not Found page. | None |
| QA-027 | Console health | Review browser console logs after the pass. | No new critical runtime errors. | Fixed, then pass: docs retest window had 0 new console errors. | Initial errors came from documentation API 500s. |

## Findings

1. Documentation API routes returned 500 during Browser Use testing.
   Evidence: browser console logged repeated Axios errors for documentation data; direct `curl` to `https://127.0.0.1:4000/api/documentation`, `/sources`, `/tags`, and `/stats` returned 500. Docker backend logs showed `relation "documentation" does not exist`.

2. Some first-pass failures were selector/timing issues, not product bugs.
   Evidence: QA-005, QA-006, and QA-012 passed on targeted retest after waiting for route load and using the current chat textbox placeholder `Type your PowerShell question...`.

3. Destructive or permission-gated controls were intentionally skipped.
   Evidence: Clear, Delete, password/session mutations, save-settings mutations, and microphone permission acceptance were not executed under the safety rules.

4. Frontend build verification was blocked by local dependency state.
   Evidence: `/Users/morlock/.nvm/versions/node/v20.19.4/bin/npm run build --prefix src/frontend` and Node `v22.16.0` both failed before app compilation with `@swc/core` native binding load failure. This is a local `node_modules`/native optional dependency issue, not caused by the SQL-only app fix.

## Fix Plan

1. Add the missing local Postgres `documentation` table to the repo schema and migrations.
2. Apply that migration to the running Docker Postgres database.
3. Retest documentation routes directly and through Browser Use.
4. Keep skipped destructive/permission tests documented instead of forcing unsafe actions.

## Fix Implemented

- Added `src/db/migrations/20260424_create_documentation_table.sql`.
- Updated `src/db/schema.sql` so fresh local databases include the `documentation` table.
- Applied the migration to the running Docker database with `docker compose exec -T postgres psql -U postgres -d psscript`.

## Retest

- Direct API retest passed:
  - `/api/documentation?limit=3` returned `{"success":true,"data":[],"total":0}`.
  - `/api/documentation/sources` returned default sources.
  - `/api/documentation/tags` returned default tags.
  - `/api/documentation/stats` returned empty stats.
- Browser Use retest passed:
  - `/documentation`, `/documentation/crawl`, and `/documentation/data` rendered correctly.
  - Retest window recorded `0` new browser console errors.

## Computer Use Retest

Run date: 2026-04-24
App: Google Chrome

| ID | Area | Computer Use Result | Issue |
| --- | --- | --- | --- |
| CU-001 | Documentation | Pass: navigated to `http://127.0.0.1:3191/documentation`; page rendered `PowerShell Documentation Explorer`, source checkboxes, tag filters, sort controls, empty state, and crawl links. | None |
| CU-002 | Chat AI | Pass: navigated to `/chat`, entered `In one sentence, what does Get-Service do in PowerShell?`, clicked Send, and received `Get-Service retrieves the status and properties of services on a local or remote computer in PowerShell.` | None |
| CU-003 | Voice dock | Pass: clicked Voice; `Voice Copilot` opened with OpenAI Audio label, Dictate, Speak selection, voice selector, speed slider, transcript area, and ready status. | Microphone dictation was not started because accepting microphone permission requires explicit confirmation. |

## Browser Use Retest - 2026-04-24 Fresh Run

Target: http://127.0.0.1:3191
Tool: Browser Use in-app browser

| ID | Area | Browser Use Result | Issue |
| --- | --- | --- | --- |
| RUN2-001 | App health | Pass: `/api/health` returned visible JSON including service status and the `documentation` table. | None |
| RUN2-002 | Auth/session | Pass: `/login` rendered login/session state or redirected into the authenticated app. | None |
| RUN2-003 | Dashboard/shell | Pass: `/dashboard` rendered dashboard content, recent activity, shell navigation, and voice entry point. | None |
| RUN2-004 | Navbar/shell controls | Pass: navbar safe controls rendered; notification/user controls were present. | Theme toggle was not clicked in this row because the focused chat control test covered the visible Light control. |
| RUN2-005 | Sidebar navigation | Pass: sidebar rendered Dashboard, Script Management, Chat Assistant, Agentic Assistant, Documentation, UI Components, and Settings links. | None |
| RUN2-006 | Analytics | Pass: `/analytics` rendered analytics/dashboard content. | None |
| RUN2-007 | Scripts list/upload/detail/analysis | Pass: `/scripts`, `/scripts/upload`, and `/scripts/1/analysis` rendered script management, upload/category controls, and analysis content. | None |
| RUN2-008 | AI chat send | Pass on focused retest: chat prompt submitted and assistant answered the `Get-Date` question. | Initial token-only assertion was too strict; focused Browser Use retest confirmed a real assistant response. |
| RUN2-009 | Chat controls and muted UI | Pass on focused retest: Search, History, Light, Clear, Upload Script, Send, and Voice controls were present; Search toggled; destructive Clear skipped. | Initial locator looked for History as a link, but the UI implements it as a button. |
| RUN2-010 | Voice dock | Pass: Voice button opened the Voice Copilot panel with Dictate/Speak controls. | Microphone dictation was not started because accepting microphone permission requires explicit confirmation. |
| RUN2-011 | Agent pages | Pass: `/ai/assistant` and `/ai/agents` rendered agentic assistant/orchestration content. | None |
| RUN2-012 | Documentation pages | Pass: `/documentation`, `/documentation/crawl`, and `/documentation/data` rendered documentation explorer/crawl/library content. | None |
| RUN2-013 | UI components | Pass on focused retest: `/ui-components` rendered UI Components content, header controls, and button examples. | Initial single navigation timeout did not reproduce. |
| RUN2-014 | Settings pages | Pass: profile, appearance, security, notifications, API, users, categories, and data settings pages rendered. | Save, reset, password/session, and maintenance mutations were skipped by safety rule. |
| RUN2-015 | 404 route | Pass: unknown route redirected/rendered Not Found/404 state. | None |
| RUN2-016 | Console health | Pass: no new relevant console errors after the corrected Browser Use run. | Earlier documentation Axios errors were stale pre-fix logs from before the documentation-table migration. |

### RUN2 Control Inventory

| Route | Controls Verified | Result |
| --- | --- | --- |
| `/chat` | Search, History, Light, Clear, Upload Script, Send, Voice | Present; Search toggled; Clear skipped as destructive. |
| `/ui-components` | Light Mode, Primary, Secondary, Success, Danger, Warning, Info, Ghost, size/state/icon/width button examples, Voice | Present and rendered without route failure. |
| `/settings/appearance` | Reset to Defaults, Save Changes, two checkbox-style display controls, Voice | Present; mutation buttons were not clicked. |
| `/settings/notifications` | All/None quick actions, Enable in Browser, Save All Settings, sixteen checkbox-style notification controls, Voice | Present; browser notification permission and save mutation were not accepted/clicked. |

### RUN2 Findings

1. Initial RUN2 route failures were false negatives from the Browser Use harness capturing the app's `Loading PSScript...` screen before route content hydrated. Corrected readiness polling showed the app routes render.

2. The initial AI chat token test was too strict for this UI because the prompt text itself contained the expected token. A focused retest with a natural `Get-Date` question confirmed the assistant responded.

3. The initial chat History locator was wrong. History is implemented as a button in this UI, not a link.

4. The console-health row initially included stale documentation Axios errors from `2026-04-24T18:22Z`, before the documentation table migration was applied. No new relevant console errors appeared during the corrected Browser Use run.

5. Destructive, permission-gated, and state-mutating controls were intentionally skipped: Clear, delete/reset actions, password/session actions, Save settings, maintenance actions, browser notification permission, and microphone permission.

### RUN2 Fix Plan

1. Keep the corrected Browser Use readiness method for future route tests: wait until `Loading PSScript...` disappears and expected route text appears before recording a failure.
2. Use control-specific locators that match the current UI semantics, especially chat History as a button.
3. Treat stale console logs by timestamp so pre-fix errors are not counted as current regressions.
4. Do not change application code unless a failure reproduces after corrected waiting and focused retest.

### RUN2 Fixes Implemented

No new application-code fixes were needed in this RUN2 pass. The earlier documentation database fix remains the concrete product fix from this QA cycle:

- `src/db/migrations/20260424_create_documentation_table.sql`
- `src/db/schema.sql`

### RUN2 Retest

Corrected Browser Use retest passed for health, auth/session, global shell, navbar/sidebar controls, analytics, script management, AI chat, chat controls, voice dock, agent pages, documentation pages, UI components, settings pages, 404 route, and current console health.

## Browser Use Retest - 2026-04-24 RUN3 Full Feature/Button/Switch Pass

Run started: 2026-04-24T19:01:35.142Z
Target: http://127.0.0.1:3191
Tool: Browser Use in-app browser

### RUN3 Test Matrix and Results

| ID | Area | Browser Use Result | Issue |
| --- | --- | --- | --- |
| RUN3-001 | App health | Pass: `/api/health` returned visible JSON including documentation table state. | None |
| RUN3-002 | Auth/session | Pass: `/login` rendered expected auth/session content. | None |
| RUN3-003 | Dashboard/shell | Pass: `/dashboard` rendered expected dashboard/shell content. | None |
| RUN3-004 | Navbar buttons | Pass: navbar buttons present: Notifications=1, User menu=1, Open menu=1. | None |
| RUN3-005 | Sidebar links | Pass: sidebar links present: Chat Assistant=1, Agentic Assistant=1, Documentation=1. | None |
| RUN3-006 | Analytics | Pass: `/analytics` rendered expected content. | None |
| RUN3-007a | Scripts list/search | Pass: `/scripts` rendered script management/search content. | None |
| RUN3-007b | Script upload controls | Pass: `/scripts/upload` rendered upload/script/category controls. | None |
| RUN3-007c | Script analysis/detail | Pass: `/scripts/1/analysis` rendered analysis/script content. | None |
| RUN3-008 | AI chat send | Pass: submitted `Get-Process` chat prompt and detected assistant response. | None |
| RUN3-009 | Chat buttons and muted controls | Pass: Back to Dashboard=1, Search=2, History=1, Light=1, Clear=1, Upload Script=1, Send=1, Voice=1. Destructive Clear skipped. | Search was not toggled in RUN3 because two Search buttons were present and the safe locator was intentionally not forced. RUN2 already validated Search toggling. |
| RUN3-010 | Voice dock | Pass: Voice dock opened with controls. | Microphone permission was not accepted. |
| RUN3-011a | Agentic assistant | Pass: `/ai/assistant` rendered expected content. | None |
| RUN3-011b | Agent orchestration | Pass: `/ai/agents` rendered expected content. | None |
| RUN3-012a | Documentation explorer | Pass: `/documentation` rendered expected content. | None |
| RUN3-012b | Documentation crawl | Pass: `/documentation/crawl` rendered expected content. | None |
| RUN3-012c | Documentation data | Pass: `/documentation/data` rendered expected content. | None |
| RUN3-013 | UI component buttons | Pass: found 20/20 component buttons: Light Mode, Primary, Secondary, Success, Danger, Warning, Info, Ghost, XS, SM, MD, LG, XL, Loading State, Left Icon, Right Icon, Rounded Full, Full Width, Disabled, Voice. | None |
| RUN3-014a | Settings profile | Pass: `/settings/profile` rendered expected content. | None |
| RUN3-014b | Settings appearance | Pass: `/settings/appearance` rendered expected content. | None |
| RUN3-014c | Settings security | Pass: `/settings/security` rendered expected content. | None |
| RUN3-014d | Settings notifications | Pass: `/settings/notifications` rendered expected content. | None |
| RUN3-014e | Settings API | Pass: `/settings/api` rendered expected content. | None |
| RUN3-014f | Settings users | Pass: `/settings/users` rendered expected content. | None |
| RUN3-014g | Settings categories | Pass: `/settings/categories` rendered expected content. | None |
| RUN3-014h | Settings data | Pass: `/settings/data` rendered expected content. | None |
| RUN3-015 | Settings buttons/switches inventory | Pass: settings appearance, notifications, and security controls were inventoried. | Mutation/save/reset actions skipped. |
| RUN3-016 | 404 route | Pass: unknown route rendered Not Found/404 content. | None |
| RUN3-017 | Console health | Pass: 0 new relevant console errors during RUN3. | None |

### RUN3 Button and Switch Inventory

| Route | Buttons / Controls Observed | Checkbox Count | Switch Count | Safety Handling |
| --- | --- | --- | --- | --- |
| `/chat` | Back to Dashboard, Search, History, Light, Clear, Upload Script, Send, Voice | Not counted | Not counted | Clear skipped as destructive. Search was not clicked in RUN3 because duplicate Search buttons made the locator ambiguous; RUN2 already validated Search toggle. |
| `/ui-components` | Light Mode, Primary, Secondary, Success, Danger, Warning, Info, Ghost, XS, SM, MD, LG, XL, Loading State, Left Icon, Right Icon, Rounded Full, Full Width, Disabled, Voice | Not counted | Not counted | Component buttons were inventoried only. |
| `/settings/appearance` | Refresh Page, AI Assistant, user avatar, Reset to Defaults, Save Changes, Voice | 2 | 0 | Reset and Save skipped as state-mutating actions. |
| `/settings/notifications` | Refresh Page, AI Assistant, user avatar, All/None groups, Enable in Browser, Save All Settings, Voice | 16 | 0 | Browser notification permission and Save skipped. |
| `/settings/security` | Refresh Page, AI Assistant, user avatar, Update Password, Enable, Revoke, Voice | 1 | 0 | Password update, 2FA enable, and revoke actions skipped. |

### RUN3 Findings

No new application bug reproduced.

Notes:

1. Duplicate `Search` buttons exist on the chat route: one in the global navbar and one in the chat page header. Browser Use did not force a click in RUN3 because the locator was ambiguous. This is not currently a user-facing bug, and RUN2 already validated chat Search toggling.
2. All destructive, state-mutating, or permission-gated actions were skipped by policy: Clear, Reset, Save, Update Password, Enable 2FA, Revoke, browser notifications, and microphone permission.
3. Console health passed with zero new relevant errors during RUN3.

### RUN3 Fix Plan

No code fix is required from RUN3 because all failures were avoided or explained by safety policy/locator ambiguity, and no product issue reproduced.

If a future test needs to click the chat page Search button specifically, scope the locator to the chat page header/main region instead of using the global button name.

### RUN3 Fixes Implemented

No application-code changes were made for RUN3.

## Computer Use Retest - 2026-04-24 AI Analysis and Report Export

Target: `https://127.0.0.1:3090/scripts/4/analysis`
Tooling: Computer Use in Google Chrome, direct API smoke checks, Playwright fallback for post-build chat assertion

| ID | Area | Result | Issue |
| --- | --- | --- | --- |
| CU-AI-001 | Analysis route | Pass: `Script Analysis` page for `Merge-Pst.GUI` rendered with Overview, Security, Code Quality, Performance, Parameters, and Psscript AI tabs. | None |
| CU-AI-002 | Analysis tabs | Pass: Security, Code Quality, Performance, Parameters, and Psscript AI tabs rendered their expected content during the Computer Use pass. | None |
| CU-AI-003 | Report export button | Fixed, then pass: `Export PDF` produced `Merge-Pst_GUI_analysis (1).pdf` and Chrome download history showed `19.7 KB - Done`. Direct API smoke also returned a valid 8-page PDF from `/api/scripts/4/export-analysis`. | The frontend had a stale inline localhost fallback to `http://localhost:4005/api`, which could break save/export when users access the app through `localhost`. |
| CU-AI-004 | Psscript AI assistant | Fixed, then pass: submitted `Summarize the top security concern in one sentence.`; backend logs showed OpenAI returned `200`; rebuilt-app browser automation rendered the answer and re-enabled the input. | Computer Use's accessibility snapshot lagged on one retest, so Playwright was used as a fallback browser assertion for final state. |
| CU-AI-005 | API evidence | Pass: backend logs showed `/api/chat` returning `200` from OpenAI, and direct `POST /api/chat` returned `response`, `text`, `provider`, and `model`. | None |
| CU-AI-006 | Analyze with AI Agents | Fixed, then pass: direct SSE smoke returned same-origin `/api/scripts/4/analysis-stream` `connected` events; rebuilt-app browser automation clicked `Analyze with AI Agents` and saw `Analyzing Script` with `10% Complete` instead of a frozen `0% Complete`. | The frontend previously built the SSE URL from `apiClient.defaults.baseURL`, producing an invalid `/scripts/4/undefined/scripts/4/analysis-stream...` URL in one browser run. After that was fixed, the panel still displayed `0% Complete` during the first long model call because the initial stage was `analyzing` instead of the progress panel's `analyze` stage. |

### CU-AI Findings

1. The save/export failure had concrete code evidence in `src/frontend/src/pages/ScriptAnalysis.tsx`: the Export PDF button used a one-off URL builder with stale `localhost:4005` fallback instead of the shared same-origin API helper.
2. The analysis-tab AI assistant had a weak request handling path. It now clears timeout state in `finally`, parses the raw response text explicitly, and accepts either `response` or `text` from the API response shape.
3. The AI Agents stream had two concrete frontend integration issues. `src/frontend/src/services/langgraphService.ts` used a stale base URL source for EventSource, and the React progress panel did not understand the Python LangGraph service's `workflow_event` SSE shape.
4. The first LangGraph model call can take over a minute for a large script. Showing `0% Complete` during that work looked like a failure even when the backend was still active.

### CU-AI Fixes Implemented

- `src/frontend/src/pages/ScriptAnalysis.tsx` now uses `getApiUrl()` for report export and triggers the browser download through an anchor click instead of a stale hard-coded API URL.
- `src/frontend/src/pages/ScriptAnalysis.tsx` now uses native `fetch` with a 60-second abort timeout for the analysis-tab AI assistant, clears that timeout in `finally`, parses the raw response text explicitly, and keeps the UI release path explicit.
- `src/frontend/src/services/langgraphService.ts` now uses the shared same-origin API helper for SSE and normalizes LangGraph `workflow_event` messages into existing `stage_change` / `completed` frontend events.
- `src/frontend/src/pages/ScriptAnalysis.tsx` now starts streamed AI Agent analysis in the `analyze` stage, matching the existing progress panel vocabulary.
- `src/frontend/src/components/Analysis/AnalysisProgressPanel.tsx` now shows early `10% Complete` progress while the first model call is running, so the UI no longer appears frozen.

### CU-AI Retest

- `docker compose exec -T frontend npm run build` passed and refreshed the running `3090` Vite preview bundle.
- `tsc -p src/frontend/tsconfig.json --noEmit` passed.
- Direct export smoke passed: `/tmp/psscript-analysis.pdf` was a valid PDF document, version 1.3, 8 pages.
- Computer Use confirmed the post-fix report download in Chrome download history.
- Playwright against the rebuilt `3090` app confirmed the Psscript AI assistant response rendered and the input re-enabled after the answer.
- Direct SSE smoke passed: `/api/scripts/4/analysis-stream?model=o4-mini&require_human_review=false` returned `connected` events from the same-origin app route.
- Playwright against the rebuilt `3090` app confirmed `Analyze with AI Agents` renders `Analyzing Script` and `10% Complete` immediately after click.
