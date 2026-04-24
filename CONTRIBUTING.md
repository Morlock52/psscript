# Contributing to PSScript

Thanks for improving PSScript. This repo is a multi-service application, so keep changes scoped and easy to review.

## Start Here

1. Read [README.md](./README.md) for the product overview and service map.
2. Read [docs/GETTING-STARTED.md](./docs/GETTING-STARTED.md) for local setup.
3. Read [docs/REPOSITORY-ORGANIZATION.md](./docs/REPOSITORY-ORGANIZATION.md) before adding new top-level folders or documentation.
4. Check the relevant service README:
   - [src/frontend/README.md](./src/frontend/README.md)
   - [src/backend/README.md](./src/backend/README.md)
   - [src/ai/README.md](./src/ai/README.md)
   - [tests/README.md](./tests/README.md)

## Branch and PR Workflow

- Create feature branches instead of committing directly to `main`.
- Use focused commits with short imperative messages.
- Keep generated files out of commits unless they are canonical artifacts listed in the docs.
- Include screenshots for UI changes when the visual behavior changes.
- Update docs in the same PR when behavior, routes, ports, commands, or screenshots change.

## Local Validation

Run the smallest reliable checks for your change first, then broaden as needed.

```bash
# frontend
cd src/frontend
./node_modules/.bin/tsc --noEmit --pretty false
npm run test:run

# backend
cd src/backend
npm run build
npm test -- --runInBand

# browser smoke
npx playwright test --project=chromium
```

If a check hangs or cannot run in your environment, note that explicitly in the PR and include the command you attempted.

## Documentation Rules

- Active user-facing docs belong under `docs/` and should be linked from [docs/index.md](./docs/index.md) or [docs/README.md](./docs/README.md).
- Historical reports belong under `docs/archive/` or should be clearly marked as historical.
- Generated exports belong under `docs/exports/` and should not be committed unless a release process explicitly requires them.
- Screenshots used by README/docs belong under `docs/screenshots/` or `docs-site/static/images/screenshots/variants/`.

## Security

Do not open public issues for secrets or vulnerabilities. Follow [SECURITY.md](./SECURITY.md).
