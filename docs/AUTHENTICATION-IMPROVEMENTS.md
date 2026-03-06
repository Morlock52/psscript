# Authentication Improvements

_Last updated: March 6, 2026_

![Settings screenshot](./screenshots/settings-profile.png)

## Current auth model

- JWT-based backend authentication for protected APIs
- Shared backend auth middleware across normal protected routes and admin DB maintenance routes
- Optional auth uses the same auth configuration path as primary auth
- Local frontend development commonly runs with `VITE_DISABLE_AUTH=true`, which creates a `dev-admin` session automatically

## Improvements reflected in code

### Unified protected-route behavior

The backend no longer maintains a separate legacy JWT middleware for admin maintenance routes.
That removes request-shape drift and secret-source drift between login-issued tokens and admin-only APIs.

### Clear auth error semantics

Authentication-related APIs return structured error payloads with stable error codes, including:
- `validation_error`
- `invalid_credentials`
- `missing_token`
- `invalid_token_format`
- `token_expired`
- `email_already_exists`
- `username_already_exists`

### DB uniqueness conflicts return `409`

Registration and profile updates translate uniqueness races into explicit `409 Conflict` responses instead of generic `500` failures.

### Demo-token bypass removed

Backend auth rejects `demo-token-*` shortcuts.
That keeps local and deployed environments aligned on real JWT validation.

## Local development behavior

The common checked-in frontend mode uses:

```bash
VITE_DISABLE_AUTH=true
```

That means:
- `/login` redirects into the authenticated app shell
- frontend screenshots taken in the default local environment show the `dev-admin` session
- real login testing requires turning auth back on before starting the frontend

Canonical local URLs:
- frontend: `https://127.0.0.1:3090`
- backend: `https://127.0.0.1:4000`

## Credential guidance

Do not treat historical references to `admin@psscript.com / ChangeMe1!` as current credentials.
Real login testing requires your actual seeded or managed credentials.
