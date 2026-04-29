# Module 01: Platform Foundations

Last updated: April 29, 2026.

## Objectives

- Sign in through Supabase Auth.
- Understand the enabled-profile approval gate.
- Navigate the current desktop and mobile shell.
- Identify Netlify Functions and hosted Supabase as the production architecture.

## Prerequisites

- Approved account for `https://pstest.morloksmaze.com`, or local mock UI mode for non-mutating classroom demos.
- No local database requirement.

## Walkthrough

1. Open the production app.
2. Sign in and confirm you are not on pending approval.
3. Review the dashboard cards.
4. On mobile width, open the navigation drawer and confirm routes are reachable.
5. Open Scripts, Assistant, Analytics, and Settings.

## Visual References

![Production login](../../screenshots/readme/login.png)

![Dashboard](../../screenshots/readme/dashboard.png)

![Settings profile](../../screenshots/readme/settings-profile.png)

## Service Map

| Service | Role | Production |
| --- | --- | --- |
| Netlify site | React app and SPA routing | `https://pstest.morloksmaze.com` |
| Netlify Functions | same-origin API | `/api/*` |
| Supabase Auth | identity/session | hosted Supabase |
| Supabase Postgres | scripts, analyses, vectors, backups | hosted Supabase |

## Key Concepts

- Enabled Supabase profile access is required for protected app/API routes.
- Hosted Supabase Postgres is the canonical database.
- Netlify Functions are the production API.
- Local mock UI mode is for demos and screenshots, not production data.

## Verification Checklist

- You can reach Dashboard, Scripts, Assistant, Analytics, and Settings.
- Mobile navigation opens and closes without covering unreadable content.
- You can explain why disabled users cannot access protected APIs.
