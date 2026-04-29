# PSScript Chronicle - April 29, 2026

This chronicle records the applied review fixes, verification evidence, and current operational notes for the review cycle covering streaming auth, backend database control routes, hosted auth tests, CSS import ordering, and Settings documentation access.

## Scope

Reviewed findings:

1. Bearer token placed in analysis stream URL.
2. Legacy backend database control route exposed.
3. Auth tests mocked only the legacy axios path.
4. CSS imports appeared after Tailwind directives.

Related follow-up:

- Settings now exposes a respectful, themed `Docs & Training` surface for lifecycle, training, screenshot, support, and governance documents.

## Applied Fixes

| Area | File | Result |
| --- | --- | --- |
| Analysis streaming auth | `src/frontend/src/services/langgraphService.ts` | Streaming uses `fetch` with `Authorization: Bearer ...`; token is not appended to the URL. |
| Backend auth middleware | `src/backend/src/middleware/authMiddleware.ts` | Query-string token fallback was removed. Auth tokens are accepted from the `Authorization` header only. |
| DB control route | `src/backend/src/routes/health.ts` | `/db/:action` remains protected by `authenticateJWT` and `requireAdmin`. |
| DB control regression tests | `src/backend/src/routes/__tests__/health-db-control.test.ts` | Added tests for unauthenticated, non-admin, and admin access. |
| Hosted auth tests | `src/frontend/src/contexts/__tests__/AuthContext.test.tsx` | Supabase wrapper is mocked directly; hosted auth tests pass without reaching `stub.supabase.co`. |
| CSS import ordering | `src/frontend/src/index.css` | Token and motion imports are before Tailwind directives. |
| Frontend regression tests | `src/frontend/src/api/__tests__/hostedAiClient.test.ts` | Added checks for no `EventSource`, no `auth_token` query parameter, fetch header auth, and CSS import order. |
| Settings docs access | `src/frontend/src/pages/Settings/DocumentationSettings.tsx` | Added in-app Settings viewer for current training/support documents and graphics. |

## Verification

Commands run and passing:

```bash
cd src/frontend
npm run test:run -- src/api/__tests__/hostedAiClient.test.ts src/contexts/__tests__/AuthContext.test.tsx
npm run build
```

```bash
cd src/backend
npm test -- --runInBand src/routes/__tests__/health-db-control.test.ts
npm run build
```

```bash
git diff --check -- \
  src/backend/src/middleware/authMiddleware.ts \
  src/frontend/src/api/__tests__/hostedAiClient.test.ts \
  src/backend/src/routes/__tests__/health-db-control.test.ts
```

Search verification:

```bash
rg -n "req\\.query\\.token|auth_token=|params\\.append\\(['\\\"]auth_token|new EventSource" src/frontend/src src/backend/src -S
```

The only remaining matches were negative assertions inside regression tests.

## Review Status

| Finding | Status | Evidence |
| --- | --- | --- |
| Bearer token in stream URL | Closed | Header-based `fetch` stream and regression test. |
| Unauthenticated DB control route | Closed | Admin middleware on route and backend route tests. |
| Auth tests mock legacy path only | Closed | Supabase service wrapper mocked; targeted tests pass. |
| CSS imports after Tailwind | Closed | Imports precede Tailwind directives; regression test added. |

## Residual Notes

- The working tree contains many unrelated existing documentation, screenshot, and deployment artifacts from earlier work. They were not reverted.
- A deploy archive exists at the repo root: `deploy-1777436109910-483ddbce-9c8f-4b1b-9593-a6b55dde44f7.zip`. It was not deleted because prior instruction was to archive rather than delete.
- The `Docs & Training` Settings route is implemented locally and passes build verification. It still requires the next Netlify deployment to appear in production.

## Next Operational Step

Deploy the current build to Netlify when ready, then smoke-check:

- `/settings/docs`
- `/agentic`
- upload with a small `.ps1`
- analysis PDF export
- delete of disposable test data
- `/api/health`
