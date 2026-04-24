# Screenshot Batch 2 (Current through Apr 23, 2026)

This batch captures the latest UI for new/updated features and is used to keep docs screenshots in sync with the current app output.

## Captured

- Dashboard
  - `images/screenshots/variants/dashboard-v1.png`
- Documentation Import (Async job, progress + cancel)
  - `images/screenshots/variants/documentation-import-running-v1.png`
- Settings -> Script Categories
  - `images/screenshots/variants/settings-categories-v1.png`
- Settings -> User Management
  - `images/screenshots/variants/settings-users-v1.png`

## Notes

- Current canonical local stack ports:
  - Frontend: `https://127.0.0.1:3090` for the full local TLS stack, or `http://127.0.0.1:3090` for an equivalent manually started Vite frontend
  - Login frontend: `http://127.0.0.1:3191` with `VITE_DISABLE_AUTH=false`
  - Backend API: `https://127.0.0.1:4000`
  - AI service: `http://localhost:8000`
- README screenshots require backend script data; the generator now fails rather than saving spinner or missing-content pages for script detail and analysis.
