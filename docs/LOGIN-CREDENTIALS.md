# PSScript Login Credentials

## Current status

This document reflects the current local-development behavior.

## Local development default

The checked-in frontend environment commonly uses:

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

Do not treat older references to these values as current source-of-truth credentials:

- `admin@psscript.com`
- `ChangeMe1!`
- `admin123`
- demo-token shortcuts

Those appear in historical test/fix reports only and are not the current recommended auth path.

## Canonical auth docs

- `docs/AUTHENTICATION-IMPROVEMENTS.md`
- `src/backend/README.md`
- `README.md`
