# Hosted Upload And Script Editing Workflow

Last updated: April 29, 2026.

This document describes the current hosted workflow. The production path is Netlify Functions plus hosted Supabase Postgres. The retired Express/multer/local-upload path is historical only and should not be used as the active runbook.

## What The User Sees

1. The user opens **Scripts -> Upload Script**.
2. The user selects or pastes a PowerShell file: `.ps1`, `.psm1`, `.psd1`, or `.ps1xml`.
3. The UI reads the file as text, shows metadata, and blocks hosted uploads above 4 MB.
4. The user adds title, description, category, tags, visibility, and optional analysis.
5. The frontend sends one JSON payload to `/api/scripts/upload` with the Supabase bearer token.
6. The API creates or identifies the hosted script record in Supabase.
7. The user can open script detail, edit the hosted record, run/view analysis, export PDF analysis, or delete disposable test scripts they own.

## Hosted Flow

```text
Browser upload form
  -> src/frontend/src/pages/ScriptUpload.tsx
  -> src/frontend/src/services/api.ts scriptService.uploadScript()
  -> POST /api/scripts/upload
  -> netlify/functions/api.ts handleScriptUpload()
  -> Supabase Auth token validation
  -> app_profiles.is_enabled approval gate
  -> content validation and SHA-256 hash
  -> scripts + script_versions + tags/script_tags
  -> optional hosted AI analysis
  -> JSON response with script, duplicate state, or analysisError
```

## Current API Contract

### `POST /api/scripts/upload`

The hosted frontend sends JSON, not a doubled multipart body:

```json
{
  "title": "Setup_OpenWebUI_LM_Studio",
  "description": "No description provided",
  "content": "# PowerShell script body",
  "category_id": 1,
  "tags": ["setup", "windows"],
  "is_public": false,
  "analyze_with_ai": true
}
```

The API returns:

| Status | Meaning |
| --- | --- |
| `201` | Script created |
| `200` or `409` duplicate response | Same script hash already exists for the user or visible scope |
| `400` | Missing content, invalid content, unsupported extension, or malformed tags |
| `401` | Missing/invalid Supabase token |
| `403` | Supabase profile exists but is not enabled |
| `413` | Hosted upload exceeds the 4 MB application limit |
| `429` | Too many upload attempts |
| `500` | Hosted API or database failure |

### `GET /api/scripts/:id`

Returns the hosted script for an authorized owner or public viewer. The edit screen uses this route to load real title, description, content, version, category, and analysis score fields.

### `PUT /api/scripts/:id`

Updates title, description, content, category, and version state for the script owner. If content changes, the API increments `version` and writes a `script_versions` row.

## Edit And VS Code Export

The script edit page now works against the hosted API:

1. Open `/scripts/:id/edit`.
2. The frontend loads the script with `scriptService.getScript(id)`.
3. The user edits title, description, or content.
4. **Save** sends `PUT /api/scripts/:id`.
5. **Open in VS Code** downloads the current editor buffer as a `.ps1` file.

The VS Code behavior is intentionally an export. A hosted Netlify page cannot directly open an unsaved database record as a local `vscode://file/...` path because it does not know or own the user's local filesystem path.

![Script editor with VS Code export](./screenshots/readme/script-edit-vscode.png)

## Analysis Runtime Requirements

Analysis pages now show runtime requirements before or after full AI analysis:

- PowerShell version guidance from saved analysis fields or script directives.
- Modules from `#Requires -Modules`, `Import-Module`, analysis JSON, and common command patterns.
- .NET assemblies from `Add-Type -AssemblyName`, displayed as assembly requirements.

Example: a script with `Add-Type -AssemblyName PresentationFramework` shows `PresentationFramework (.NET assembly)`.

![Runtime requirements panel](./screenshots/readme/analysis-runtime-requirements.png)

## Database Tables

| Table | Role |
| --- | --- |
| `scripts` | Current script title, description, content, owner, category, visibility, hash, version, and lifecycle flags |
| `script_versions` | Version history for content changes |
| `script_analysis` | Latest analysis scores and JSON payloads |
| `categories` | Hosted taxonomy |
| `tags` / `script_tags` | Many-to-many tags |
| `app_profiles` | Supabase profile gate and roles |
| `ai_metrics` | Best-effort provider/model/token/cost telemetry |

## Operational Rules

- Hosted Supabase is the database of record.
- Do not introduce a local database for production or training.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, or AI provider keys to the browser.
- Treat uploads as sensitive code until the owner intentionally shares them.
- Use disposable test records for smoke tests and clean them up through the app or API.
- Include Netlify deploy ID, route, user role, and screenshot when filing support issues.

## Verification Checklist

- Upload rejects files larger than 4 MB with a clear error.
- Upload creates a script and initial version.
- Duplicate content routes to the existing script instead of creating confusing copies.
- Edit page loads real hosted data.
- Save persists title, description, and content.
- **Open in VS Code** downloads a `.ps1` copy of the current editor buffer.
- Analysis page shows runtime requirements.
- PDF export downloads `application/pdf`.
- Delete and bulk delete affect only intended authorized records.
