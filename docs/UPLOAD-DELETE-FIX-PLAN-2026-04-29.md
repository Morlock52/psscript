# Upload And Delete Fix Plan - April 29, 2026

## Scope

Fix the hosted file upload and script delete issues on the Netlify + Supabase path.

## Research Notes

- Netlify synchronous Functions have a buffered request/response payload limit, and binary request payloads have lower effective capacity because they are base64 encoded before reaching the function runtime.
- Supabase RLS should remain enabled for exposed tables, and delete policies should use explicit ownership checks. The hosted API also enforces ownership/admin checks before issuing SQL.

References reviewed:

- Netlify Functions limits: https://docs.netlify.com/build/functions/overview/
- Supabase RLS policies: https://supabase.com/docs/guides/database/postgres/row-level-security

## Issue 1: Upload Fails In Hosted Mode

### Core issue

The upload form currently builds a multipart request containing both:

- `script_file` with the file bytes
- `content` with the full script text

That duplicates the script payload. On Netlify Functions this is fragile because multipart/binary uploads hit a lower effective payload ceiling than plain text/JSON. The UI also allows sizes that the hosted function cannot reliably accept.

### Fix

1. Prefer JSON upload for PowerShell text content that the browser has already read.
2. Keep multipart support in the API for compatibility, but do not require it for normal uploads.
3. Add server-side hosted content-size validation with a clear `413 upload_too_large` error.
4. Preserve upload-time AI analysis behavior for both JSON and multipart inputs.
5. Return duplicate metadata consistently so the UI can route to the existing script.

## Issue 2: Delete Appears Successful When Nothing Was Deleted

### Core issue

The hosted delete path can return `{ success: true, deleted: 0 }`. The frontend treats that as success, so not-owned, already-deleted, or inaccessible scripts can look like they were deleted even when the row remains.

### Fix

1. Make delete authorization explicit:
   - owners can delete their own scripts
   - admins can delete any script returned by the hosted API
2. Return `404 script_not_found_or_not_deletable` when no requested script can be deleted.
3. For bulk deletes, return `requested`, `deleted`, `deletedIds`, and `notDeletedIds`.
4. Keep child cleanup idempotent and rely on Supabase/Postgres cascades as a safety net.
5. Update the frontend success/error handling to report actual delete counts.

## Test Plan

1. Add focused frontend service tests for:
   - JSON upload payload selection
   - duplicate upload metadata propagation
   - delete zero-count response handling
2. Run frontend unit tests.
3. Run frontend build.
4. Type-check Netlify function files.
5. Deploy to Netlify.
6. Run a hosted smoke script:
   - create a temporary Supabase auth user
   - upload a unique test script through production `/api/scripts/upload`
   - verify the script is listed
   - delete the script through production `/api/scripts/:id`
   - verify the script no longer appears
   - create a temporary second script
   - clear test data through admin maintenance or direct test cleanup
   - delete the temporary auth/profile data created for the test

## Clear-Test-Data Plan

Only records created by the hosted smoke test should be removed automatically. Broad production data wipe is not part of this fix. If the admin Data Maintenance `clear-test-data` route is exercised, it must run with `backupFirst: true` and test-only identifiers.

## Implementation Results

Completed on April 29, 2026.

### Changes Made

- `src/frontend/src/pages/ScriptUpload.tsx`
  - Replaced multipart upload construction with a JSON payload for hosted uploads.
  - Added a 4MB hosted upload limit in the UI to match the Netlify Functions path.
  - Kept upload-time AI analysis behavior through the hosted upload endpoint.
- `src/frontend/src/services/api.ts`
  - Routed JSON uploads to `/scripts/upload` instead of `/scripts`, so hosted upload behavior is consistent for file and pasted content.
  - Updated hosted `413` handling to surface the server's upload-size message.
- `netlify/functions/api.ts`
  - Added JSON and multipart parsing for `/scripts/upload`.
  - Added server-side PowerShell extension validation and `4MB` content-size validation.
  - Changed single and bulk delete responses to report `requested`, `deleted`, `deletedIds`, and `notDeletedIds`.
  - Changed zero-row delete results to `404 script_not_found_or_not_deletable`.
  - Allowed admins to delete any script while preserving owner-only deletes for normal users.
- `src/frontend/src/pages/ManageFiles.tsx`
  - Restricted delete selection and delete buttons to script owners and admins.
  - Removed optimistic UI deletion before the server confirms the row was deleted.
- `src/frontend/src/api/__tests__/hostedAiClient.test.ts`
  - Added contract coverage for hosted upload/delete behavior.
- `scripts/smoke-upload-delete-hosted.mjs`
  - Added a repeatable production smoke that creates a temporary Supabase auth user, uploads/deletes scripts through Netlify, and cleans up only its own test records.

### Verification

- Focused frontend contract test: passed.
  - `npm test -- --run src/api/__tests__/hostedAiClient.test.ts`
- Full frontend test suite: passed.
  - `npm run test:frontend`
  - 16 test files passed, 110 tests passed.
- Netlify function TypeScript check: passed.
  - `npx tsc --noEmit --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types node --lib ES2022,DOM netlify/functions/api.ts netlify/functions/_shared/auth.ts netlify/functions/_shared/db.ts netlify/functions/_shared/env.ts netlify/functions/_shared/http.ts`
- Netlify production build: passed.
  - `npm run build:netlify`
- Netlify deploy: passed.
  - Deploy ID: `69f18b243b1897b139fb5b9a`
  - Site URL: `https://pstest.morloksmaze.com`
- Hosted health check: passed.
  - `/api/health` returned healthy with database connected.
- Hosted upload/delete smoke: passed.
  - Uploaded and deleted script IDs `18`, `19`, and `20`.
  - Verified repeat delete returns `404`.
- Test data cleanup: passed.
  - Remaining smoke scripts: `0`.
  - Remaining smoke profiles: `0`.

### Notes

The broad Data Maintenance clear route was not used because it is designed to clear whole tables. This fix needed exact cleanup of smoke-test records only, so the smoke script removed only records with its unique title prefix and temporary auth/profile identity.
