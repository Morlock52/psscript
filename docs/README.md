# PSScript Documentation

This folder contains active product docs, operational references, screenshots, training material, and historical reports.

## Start Here

- [Documentation Hub](./index.md) - active index and source-of-truth links
- [Getting Started](./GETTING-STARTED.md) - local setup and first validation
- [Repository Organization](./REPOSITORY-ORGANIZATION.md) - where files belong and what should be archived
- [Data Maintenance](./DATA-MAINTENANCE.md) - admin database backup, restore, cleanup, and integrity flows
- [Voice API](./README-VOICE-API.md) - voice/listening implementation and API behavior
- [Updates](./UPDATES.md) - chronological change log and validation history

## Current Documentation Taxonomy

The active docs use a practical Diataxis-style split:

- Tutorials and walkthroughs: `GETTING-STARTED.md`, `training-suite/`, `UPLOAD-WORKFLOW.md`
- How-to and operations: `DATA-MAINTENANCE.md`, `DEPLOYMENT-PLATFORMS.md`, `SUPPORT.md`, `MANAGEMENT-PLAYBOOK.md`
- Reference: `DATABASE_DOCUMENTATION.md`, `README-VOICE-API.md`, `README-VECTOR-SEARCH.md`
- Explanation and decisions: `PROJECT-REVIEW-2026-04-01.md`, `TECH-REVIEW-2026.md`, `AI-FUNCTIONS-REVIEW-2026-04-02.md`
- Historical artifacts: `archive/` and duplicated `* (1).md` files pending cleanup
- Generated exports: `exports/` and should be regenerated, not hand-edited

## Screenshot Locations

- Product screenshots: `screenshots/`
- Docs site variants: `../docs-site/static/images/screenshots/variants/`
- Screenshot index: `../docs-site/SCREENSHOT_LIST.md`

## Maintenance Rules

- Link active docs from [index.md](./index.md).
- Put new operational docs in `docs/` with clear names.
- Put historical reports under `docs/archive/`.
- Do not create duplicate `filename (1).md` files.
- Do not hand-edit generated exports in `docs/exports/`.
