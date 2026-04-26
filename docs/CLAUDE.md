# Claude Code Reference

> **Note:** The main Claude Code guide is at the project root: [../CLAUDE.md](../CLAUDE.md)

This file provides quick reference commands for common development tasks.

_Last updated: April 2, 2026_

## Quick Commands

### Lint Commands

```bash
# Run all linting
npm run lint

# Fix automatically
npm run lint:fix

# Backend only
npm run lint:backend
npm run lint:backend:fix

# Frontend only
npm run lint:frontend
npm run lint:frontend:fix
```

### Type Checking

```bash
cd src/backend && npm run typecheck
```

### Testing

```bash
# Backend unit tests
cd src/backend && npm test

# Cache stress tests
cd src/backend && npx jest src/__tests__/cacheService.test.ts --forceExit

# Playwright E2E (requires services running)
npx playwright test --project=chromium

# Project review validation tests
npx playwright test tests/e2e/project-review-validation.spec.ts --project=chromium
```

### Port Management

```bash
./scripts/ensure-ports.sh status
./scripts/ensure-ports.sh kill-frontend
./scripts/ensure-ports.sh kill-backend
```

## Service Ports (Fixed)

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 4000 |
| AI Service | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## AI Models (April 2026)

| Purpose | Model |
|---------|-------|
| Code generation | `gpt-4.1` |
| Flagship | `gpt-5.5` |
| Fast | `gpt-5.4-mini` |
| Reasoning | `o3` / `o4-mini` |
| Embeddings | `text-embedding-3-large` |
| TTS | `gpt-4o-mini-tts` |
| STT | `gpt-4o-mini-transcribe` |

---

For the complete development guide, see [../CLAUDE.md](../CLAUDE.md)
