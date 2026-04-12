# Browser and E2E Tests

Playwright coverage for the frontend shell, protected routes, settings flows, script management, health checks, AI analytics, and agent orchestration.

## Canonical local targets

- Frontend: `https://127.0.0.1:3090`
- Backend: `https://127.0.0.1:4000`
- AI service: `http://127.0.0.1:8000`

These values match `playwright.config.ts`, `docker-compose*.yml`, and the frontend runtime URL detection.

## Primary configs

- Source-of-truth Playwright config: `playwright.config.ts`
- Generated local override used in some ad hoc runs: `output/playwright/local.config.cjs`

Treat `output/playwright/local.config.cjs` as a local artifact, not the canonical checked-in config.

## Main suites

- `tests/e2e/health-checks.spec.ts`
- `tests/e2e/authentication.spec.ts`
- `tests/e2e/script-management.spec.ts`
- `tests/e2e/categories-settings.spec.ts`
- `tests/e2e/ai-analytics.spec.ts`
- `tests/e2e/ai-agents.spec.ts`

## Run commands

## Prerequisites

Playwright now self-bootstraps the app stack through `webServer`.
By default, `npx playwright test` uses `PLAYWRIGHT_STACK_MODE=auto`:

- prefers the checked-in Docker stack when Docker Engine is available
- falls back to the local dev stack when Docker is unavailable
- reuses any stack that is already listening on the expected ports

From a fresh clone, Playwright will start or reuse:

- frontend at `https://127.0.0.1:3090`
- backend at `https://127.0.0.1:4000`
- AI service at `http://127.0.0.1:8000`
- postgres and redis dependencies

Default requirements for `auto` mode:

- Docker Engine and `docker compose`, or
- a local PostgreSQL + Redis + Python + Node toolchain with the repo dependencies already installed

Mode overrides:

- `PLAYWRIGHT_STACK_MODE=docker npx playwright test`
- `PLAYWRIGHT_STACK_MODE=local npx playwright test`

The local fallback starts:

- FastAPI AI service from `src/ai`
- Express backend from `src/backend`
- Vite frontend from `src/frontend`

using the same local ports and TLS certificates as the checked-in Docker setup.

### Chromium smoke

```bash
npx playwright test --project=chromium
PLAYWRIGHT_STACK_MODE=local npx playwright test --project=chromium
```

### Full matrix

```bash
npx playwright test
```

### Specific suite

```bash
npx playwright test tests/e2e/categories-settings.spec.ts --project=chromium
```

### Headed or debug

```bash
npx playwright test --headed --project=chromium
npx playwright test --debug tests/e2e/script-management.spec.ts
```

## Auth note

The checked-in local frontend commonly runs with `VITE_DISABLE_AUTH=true`.

That means:
- the app auto-enters the authenticated shell
- some login-form-only tests are intentionally skipped in local validation
- helpers should tolerate both direct protected-route access and redirects to `/login`

## Screenshot generation

The canonical docs screenshots come from:

```bash
SCREENSHOT_LOGIN_URL=https://127.0.0.1:3191 node scripts/capture-screenshots.js
```

The generator uses the standard local app on `3090` for the main app-shell screenshots and an optional auth-enabled frontend on `3191` for `login.png`.

Additional UI-specific screenshot specs live under `tests/e2e/*screenshots*.spec.ts`.
Those screenshot and `tests/e2e/tmp/*` specs are utility flows and are excluded from the default Playwright matrix.

## Reports and artifacts

```bash
npx playwright show-report
```
