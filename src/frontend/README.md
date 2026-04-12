# Frontend

React + TypeScript + Vite UI for browsing scripts, running analyses, managing categories and settings, and working with AI- and voice-enabled features.

![Settings screenshot](../../docs/screenshots/settings.png)
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

Latest validated browser result on April 12, 2026:
- `npx playwright test tests/e2e/health-checks.spec.ts --project=chromium`
- `npx playwright test tests/e2e/script-management.spec.ts --project=chromium`
- `npx playwright test tests/e2e/ai-analytics.spec.ts --project=chromium`
- `npx playwright test tests/e2e/project-review-validation.spec.ts --project=chromium`
- `24` passed, `0` failed across those suites, plus categories and data-maintenance flows validated separately

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

## Notes

- If you need the real login screen, run the frontend with `VITE_DISABLE_AUTH=false` and point it at an auth-enabled backend.
- In the default local mode, `/login` redirects to `/dashboard`.
- The frontend is expected to talk to the backend on `https://127.0.0.1:4000` in local dev unless `VITE_API_URL` overrides it.
