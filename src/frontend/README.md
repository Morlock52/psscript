# Frontend

React + TypeScript + Vite UI for browsing scripts, running analyses, managing categories and settings, and working with AI- and voice-enabled features.

![Dashboard screenshot](../../docs/screenshots/dashboard.png)
![Analysis screenshot](../../docs/screenshots/analysis.png)

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
- The current app shell uses the PSScript command-deck brand: a reusable SVG brand mark, dark PowerShell grid background, glass navigation, branded dashboard hero, and branded script-analysis header.

## Main areas

- Dashboard
- Script management and upload
- Script analysis and detail views
- AI analytics and agent orchestration
- Documentation crawl tooling
- Settings pages for profile, appearance, security, notifications, categories, users, API keys, and data maintenance

## Current branded screens

The April 23, 2026 screenshot refresh covers:

- `../../docs/screenshots/dashboard.png`
- `../../docs/screenshots/dashboard-mobile.png`
- `../../docs/screenshots/scripts.png`
- `../../docs/screenshots/upload.png`
- `../../docs/screenshots/analysis.png`
- `../../docs/screenshots/settings-categories.png`
- `../../docs/screenshots/data-maintenance.png`
- `../../docs/screenshots/analytics.png`

## Browser validation coverage

The main Playwright suites cover:
- dashboard and protected-route access
- categories create/edit/delete and uncategorize-delete
- script upload and script list/search flows
- backend, AI, DB, and Redis health checks
- AI analytics and agent orchestration routes

Latest validated browser result on April 23, 2026:
- Playwright Chromium smoke against `http://127.0.0.1:3091/dashboard` and `http://127.0.0.1:3091/scripts/14/analysis`
- Dashboard, mobile dashboard, and analysis branding rendered with no browser console/page errors
- Analysis Dashboard button navigated to `/dashboard`, and the Dashboard nav link had `aria-current="page"`
- The broader April 12, 2026 Playwright suite results remain in `../../docs/UPDATES.md`

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

Latest validated unit result on April 12, 2026:
- frontend unit tests passed previously at `33/33`
- current frontend validation focus was live browser coverage against the running stack

Latest type-check result on April 23, 2026:
- `./node_modules/.bin/tsc --noEmit --pretty false` passed
- targeted ESLint hung with no output and was killed, so no current lint pass is claimed here

## Notes

- If you need the real login screen, run the frontend with `VITE_DISABLE_AUTH=false` and point it at an auth-enabled backend.
- In the default local mode, `/login` redirects to `/dashboard`.
- The frontend is expected to talk to the backend on `https://127.0.0.1:4000` in local dev unless `VITE_API_URL` overrides it.
