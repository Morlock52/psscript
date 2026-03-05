# Frontend

React + TypeScript + Vite UI for browsing scripts, running analyses, working with documentation, and managing settings.

![Settings screenshot](../../docs/screenshots/settings-profile.png)

## Local defaults

- URL: `https://127.0.0.1:3090`
- Backend API: `https://127.0.0.1:4000/api`
- AI service: `http://127.0.0.1:8000`

## Current frontend behavior

- Route-level lazy loading is enabled for heavier pages in the current source tree.
- The local default environment sets `VITE_DISABLE_AUTH=true`, so the app auto-signs in as `dev-admin` during local development.
- API requests use runtime URL detection to avoid bad `backend:4000` browser-side URLs.
- The current screenshot set was regenerated from a workspace-backed Vite session to avoid stale long-running container state.

## Main areas

- Dashboard
- Script management
- Chat and agentic assistant views
- Documentation and crawl tooling
- Settings pages for profile, appearance, security, notifications, categories, users, API keys, and data maintenance

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
npm run build
npm run test:run
```

## Notes

- If you want to validate the real login screen, set `VITE_DISABLE_AUTH=false` before starting the frontend.
- During local auth-disabled mode, `/login` redirects to `/dashboard`.
