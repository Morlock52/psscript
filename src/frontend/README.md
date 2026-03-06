# Frontend

React + TypeScript + Vite UI for browsing scripts, running analyses, managing categories and settings, and working with AI- and voice-enabled features.

![Settings screenshot](../../docs/screenshots/settings-profile.png)
![Scripts screenshot](../../docs/screenshots/scripts.png)

## Canonical local target

- Frontend URL: `https://127.0.0.1:3090`
- Backend API: `https://127.0.0.1:4000/api`
- AI service: `http://127.0.0.1:8000`

## Current frontend behavior

- Route-level lazy loading is enabled for heavier pages.
- Runtime API URL detection now matches the checked-in backend default on `:4000`.
- Multipart script uploads now let the browser set the form boundary and route large single-file uploads to `/scripts/upload/large`.
- The canonical screenshot set is captured from the same local runtime documented here.
- The default local frontend mode commonly uses `VITE_DISABLE_AUTH=true`, so the app auto-signs in as `dev-admin`.

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

Latest validated browser result on March 6, 2026:
- `npx playwright test --project=chromium`
- `28` passed, `3` skipped

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

Latest validated unit result on March 6, 2026:
- `4` test files
- `33` tests passed

## Notes

- If you need the real login screen, set `VITE_DISABLE_AUTH=false` before starting the frontend.
- In the default local mode, `/login` redirects to `/dashboard`.
- The frontend is expected to talk to the backend on `https://127.0.0.1:4000` in local dev unless `VITE_API_URL` overrides it.
