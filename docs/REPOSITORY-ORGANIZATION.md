# Repository Organization

Last reviewed: April 23, 2026.

## Goal

Keep the GitHub repository easy to navigate, safe to contribute to, and clear about which files are active source, generated output, support tooling, or historical archive.

## Research Basis

This plan follows:

- GitHub repository guidance: README, license, contribution guidelines, security posture, and branch-based collaboration.
- GitHub contributor guidance: `CONTRIBUTING.md` in the root, `docs`, or `.github` so GitHub surfaces it during issues and pull requests.
- GitHub Docs content guidance: write docs around user tasks, use clear structure, keep content scannable, and avoid burying core information.
- Diataxis documentation taxonomy: separate tutorials, how-to guides, reference, and explanation.
- Current monorepo practice: explicit service boundaries and shared tooling, with generated artifacts excluded from source control.

## Current Top-Level Areas

| Path | Status | Purpose |
| --- | --- | --- |
| `src/frontend/` | Active | React/Vite frontend |
| `src/backend/` | Active | Express/TypeScript API |
| `src/ai/` | Active | FastAPI/LangGraph AI service |
| `src/db/` | Active | PostgreSQL schema, seeds, and DB docs |
| `tests/` | Active | Playwright and E2E coverage |
| `scripts/` | Active | Operational and validation scripts |
| `docs/` | Active + historical | Documentation, screenshots, reports, and exports |
| `docs-site/` | Active | Documentation site assets and screenshot variants |
| `.github/` | Active | Workflows, issue templates, PR template, CODEOWNERS |
| `docker/`, `docker-compose*.yml`, `deploy/` | Active | Local and deployment infrastructure |
| `claude-canvas/`, `crawl4ai-vector-db/`, `product-website/` | Support/subproject | Adjacent projects or integrations; keep documented and isolated |
| `output/`, `docs/exports/`, `playwright-results.json` | Generated | Should not receive new committed artifacts by default |
| `backups/`, `db-backups/` | Runtime/generated | Keep placeholders only; do not commit real backups |

## Target Structure

```text
psscript/
├── .github/                 # repo health, workflows, templates, ownership
├── docs/                    # active docs, screenshots, archive, generated exports
├── docs-site/               # docs website and published screenshot variants
├── docker/                  # Docker support services
├── scripts/                 # repeatable operational scripts
├── src/
│   ├── frontend/            # deployable web UI
│   ├── backend/             # deployable API
│   ├── ai/                  # deployable AI service
│   ├── db/                  # database schema/seeds
│   └── powershell/          # PowerShell integration assets
├── tests/                   # E2E and browser tests
├── tools/                   # local developer utilities
└── README.md                # GitHub landing page
```

## Documentation Rules

- Active docs must be linked from `docs/index.md` or `docs/README.md`.
- New docs should be named for the user task or decision they support.
- Historical reports should move to `docs/archive/` after link checks.
- Generated HTML/PDF/DOCX exports should be reproducible from Markdown and ignored by default.
- Screenshots used in README/docs should live under `docs/screenshots/` or the docs-site screenshot variant folder.

## Cleanup Backlog

Do these in separate PRs so review remains safe:

1. Audit references to duplicated `docs/* (1).md` files, then move unreferenced duplicates under `docs/archive/duplicates-YYYY-MM-DD/` or delete them.
2. Decide whether `docs/exports/` is a release artifact. If not, remove tracked exports and regenerate them in CI or local release scripts.
3. Audit `output/`, `.playwright-cli/`, `db-backups/`, and `backups/` and remove any tracked generated files that are not needed for reproducible builds.
4. Decide whether support projects (`crawl4ai-vector-db`, `product-website`, `claude-canvas`) remain in this repo, become submodules, or move to separate repositories.
5. Add path-based CI so frontend-only changes do not run unnecessary backend/AI jobs and backend-only changes do not rebuild docs exports.

## Completed in This Pass

- Added root contribution and security policies.
- Added `.github/CODEOWNERS` for clear review ownership.
- Added this repository organization guide and a docs landing README.
- Updated `.gitignore` to prevent future generated output, backup, and Playwright artifacts from being committed.
- Made existing safe `.env.example` templates visible for deploy, AI, and frontend setup.
- Updated the root README to describe the broader repository layout honestly.
