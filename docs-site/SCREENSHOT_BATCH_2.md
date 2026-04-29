# Screenshot Batch 2 (Current through Apr 29, 2026)

This batch captures the latest UI for new/updated features and is used to keep docs screenshots in sync with the current app output.

## Captured

- Dashboard
  - `images/screenshots/variants/dashboard-v1.png`
- Documentation Import (Async job, progress + cancel)
  - `images/screenshots/variants/documentation-import-running-v1.png`
- Settings -> Script Categories
  - `images/screenshots/variants/settings-categories-v1.png`
- Settings -> Script Categories non-destructive state
  - `images/screenshots/variants/settings-categories-delete-confirm-v1.png`
- Settings -> User Management
  - `images/screenshots/variants/settings-users-v1.png`
- Script editor with VS Code export
  - `images/screenshots/variants/script-edit-vscode-v1.png`
- Analysis runtime requirements
  - `images/screenshots/variants/analysis-runtime-requirements-v1.png`
- Settings -> Appearance
  - `images/screenshots/variants/settings-appearance-v1.png`

## Notes

- Current canonical app targets:
  - Netlify frontend: `https://pstest.morloksmaze.com`
  - Frontend: `https://127.0.0.1:3090` for the full local TLS stack, or `http://127.0.0.1:3090` for an equivalent manually started Vite frontend
  - Login frontend: `http://127.0.0.1:3191` with `VITE_DISABLE_AUTH=false`
  - Backend API: `https://127.0.0.1:4000`
  - AI service: `http://localhost:8000`
- Local and preview builds use hosted Supabase Postgres via `DATABASE_URL`.
- README screenshots require backend script data; the generator now fails rather than saving spinner or missing-content pages for script detail and analysis.
- Edit and runtime-requirement captures were refreshed from an authenticated hosted Chrome session using existing safe sample script data.
- Delete-confirm screenshots should be captured only against local or staging data where the target category is disposable.
