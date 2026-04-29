# PSScript Login Credentials

## Current status

This document reflects the current hosted-auth posture and the local mock UI mode used for screenshots.

## Local development default

The common checked-in frontend mode uses:

```bash
VITE_DISABLE_AUTH=true
```

When that flag is enabled:
- the app auto-signs in as `dev-admin`
- the normal login form is bypassed
- `/login` redirects to `/dashboard`

## Real login testing

If you want to test real authentication instead of the local dev bypass:

1. Set `VITE_DISABLE_AUTH=false`
2. Restart the frontend
3. Use your actual seeded or environment-specific credentials

## Important credential note

Do not treat older references to these values as current credentials:
- `admin@psscript.com`
- `ChangeMe1!`
- `admin123`
- demo-token shortcuts

Those values appear only in historical reports, legacy tests, or environment-specific seed paths.

## Canonical URLs

- production app: `https://pstest.morloksmaze.com`
- production API health: `https://pstest.morloksmaze.com/api/health`
- local mock UI: `http://127.0.0.1:5173` when started with `VITE_DISABLE_AUTH=true VITE_USE_MOCKS=true`

## Canonical auth docs

- `docs/AUTHENTICATION-IMPROVEMENTS.md`
- `src/backend/README.md`
- `README.md`
