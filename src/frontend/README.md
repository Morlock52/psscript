# Frontend

React + TypeScript + Vite UI for browsing scripts, running analyses, managing categories and settings, and working with AI- and voice-enabled features.

![Settings screenshot](../../docs/screenshots/settings.png)
![Scripts screenshot](../../docs/screenshots/scripts.png)

## Canonical local target

- Frontend URL: `https://127.0.0.1:3090`
- Auth-enabled QA URL: `http://127.0.0.1:3191`
- Backend API: `https://127.0.0.1:4000/api`
- AI service: `http://127.0.0.1:8000`

## Current frontend behavior

- Route-level lazy loading is enabled for heavier pages.
- Runtime API URL detection now matches the checked-in backend default on `:4000`.
- Multipart script uploads now let the browser set the form boundary and route large single-file uploads to `/scripts/upload/large`.
- The canonical screenshot set is captured from the same local runtime documented here.
- The default local frontend mode commonly uses `VITE_DISABLE_AUTH=true`, so the app auto-signs in as `dev-admin`.
- The current UI baseline uses the muted PSScript brand shell, muted chat controls, and muted Voice Copilot dock.

## Main areas

- Dashboard
- Script management and upload
- Script analysis and detail views
- AI analytics and agent orchestration
- Documentation crawl tooling
- Settings pages for profile, appearance, security, notifications, categories, users, API keys, and data maintenance

## Browser validation coverage

The main Playwright suites cover:
- dashboard and protected-route access
- categories create/edit/delete and uncategorize-delete
- script upload and script list/search flows
- backend, AI, DB, and Redis health checks
- AI analytics and agent orchestration routes

Latest Browser Use validation on April 24, 2026:
- `BROWSER_USE_QA.md` RUN2 passed health, auth/session, dashboard shell, navbar/sidebar controls, analytics, script management, AI chat, chat controls, Voice Copilot, agent pages, documentation pages, UI components, settings pages, 404 route, and current console health.
- Destructive and permission-gated actions were skipped: Clear/Delete/Reset, save-settings mutations, password/session actions, browser notification permission, and microphone permission.

## Local development

```bash
npm install
npm run dev
```

Open:

```text
https://127.0.0.1:3090
```

## Build and test

```bash
npm run lint
npm run build
npm run test:run
```

Latest TypeScript/frontend validation on April 24, 2026:
- `tsc -p src/frontend/tsconfig.json --noEmit` passed after the muted UI changes.
- Browser Use validated the running app at `http://127.0.0.1:3191`.
- A prior full `npm run build --prefix src/frontend` attempt was blocked by a local `@swc/core` native binding load issue in `node_modules`; reinstall frontend dependencies if that recurs.

## Notes

- If you need the real login screen, run the frontend with `VITE_DISABLE_AUTH=false` and point it at an auth-enabled backend.
- In the default local mode, `/login` redirects to `/dashboard`.
- The frontend is expected to talk to the backend on `https://127.0.0.1:4000` in local dev unless `VITE_API_URL` overrides it.
- Hosted mode uses Supabase browser env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_HOSTED_STATIC_ANALYSIS_ONLY=true`.
