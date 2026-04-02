# File Upload Workflow Documentation

_Last updated: April 2, 2026_

## Overview

The upload workflow handles PowerShell script files from the user's browser to persistent storage in PostgreSQL. It supports drag-and-drop, file picker, and paste-based input with automatic AI analysis.

## Flow Diagram

```
User selects .ps1 file
       |
       v
[Frontend: ScriptUpload.tsx]
  1. FileReader reads content into state
  2. File metadata extracted (name, size, type)
  3. Content preview rendered (14-line preview)
  4. User fills title, description, tags, category
       |
       v
[Frontend: prepareFormData()]
  5. Builds FormData with fields:
     - title (string)
     - description (string)
     - content (string - file text)
     - category_id (string, optional)
     - tags (JSON string array, optional)
     - is_public (string: 'true'/'false')
     - analyze_with_ai (string: 'true'/'false')
     - script_file (File blob from input or content)
       |
       v
[Frontend: api.ts uploadScript()]
  6. Sends POST to /api/scripts/upload (FormData)
     - Or /api/scripts/upload/large for files > 2MB
     - Auth token in Authorization header
     - Browser auto-sets Content-Type: multipart/form-data
       |
       v
[Backend: routes/scripts.ts]
  7. Middleware chain:
     uploadCorsMiddleware -> authenticateJWT ->
     handleNetworkErrors -> handleUploadProgress ->
     multer.single('script_file') -> handleMulterError ->
     ScriptExportController.uploadScript
       |
       v
[Backend: export.ts uploadScript()]
  8. Extract file content:
     - Primary: req.file.buffer (multer memory storage)
     - Fallback: req.body.content (FormData text field)
  9. Calculate MD5 hash for deduplication
  10. Check for duplicate hash in scripts table
  11. Validate UTF-8 readability (reject binary)
  12. Validate PowerShell structure for .ps1 files
       |
       v
[Database: PostgreSQL]
  13. BEGIN TRANSACTION
  14. INSERT INTO scripts (title, content, user_id, file_hash, ...)
  15. INSERT INTO script_versions (script_id, version=1, content, ...)
  16. INSERT INTO tags + script_tags (if tags provided)
  17. COMMIT
  18. Save file to uploads/ directory
       |
       v
[Response: 201 Created]
  19. Return { success, script, message, filePath }
       |
       v
[Async: AI Analysis]
  20. If analyze_with_ai=true, fire-and-forget with 2 retries
  21. POST to AI service /analyze
  22. UPSERT into script_analysis table
```

## Database Schema

### scripts table

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | integer | NOT NULL | auto-increment | Primary key |
| title | varchar(255) | NOT NULL | - | Script display name |
| description | text | YES | - | User description |
| content | text | NOT NULL | - | Full script content |
| user_id | integer | YES | - | FK to users.id (CASCADE delete) |
| category_id | integer | YES | - | FK to categories.id (SET NULL delete) |
| version | integer | NOT NULL | 1 | Current version number |
| is_public | boolean | NOT NULL | false | Visibility flag |
| execution_count | integer | NOT NULL | 0 | Times executed |
| file_hash | varchar(255) | YES | - | MD5 for dedup (model maps to STRING(64)) |
| views | integer | NOT NULL | 0 | View count |
| created_at | timestamptz | YES | CURRENT_TIMESTAMP | Auto-set |
| updated_at | timestamptz | YES | CURRENT_TIMESTAMP | Auto-updated via trigger |

### script_versions table

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | integer | NOT NULL | auto-increment | Primary key |
| script_id | integer | YES | - | FK to scripts.id (CASCADE delete) |
| version | integer | NOT NULL | - | Version number |
| content | text | NOT NULL | - | Full content at this version |
| commit_message | text | YES | - | Changelog (model field: `changelog`) |
| user_id | integer | YES | - | FK to users.id (SET NULL delete) |
| created_at | timestamptz | YES | CURRENT_TIMESTAMP | Auto-set |

**Unique constraint:** (script_id, version)

### script_analysis table

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | integer | NOT NULL | auto-increment | Primary key |
| script_id | integer | YES | - | FK to scripts.id (CASCADE delete), UNIQUE |
| purpose | text | YES | - | AI-detected purpose |
| security_score | double | YES | - | 0-10 scale |
| quality_score | double | YES | - | 0-10 scale |
| risk_score | double | YES | - | 0-10 scale |
| parameter_docs | jsonb | YES | {} | Detected parameters |
| suggestions | jsonb | YES | [] | Optimization suggestions |
| command_details | jsonb | YES | [] | PowerShell commands found |
| ms_docs_references | jsonb | YES | [] | Microsoft docs links |
| security_issues | jsonb | YES | [] | Detailed security findings |
| best_practice_violations | jsonb | YES | [] | PSScriptAnalyzer-style violations |
| performance_insights | jsonb | YES | [] | Performance recommendations |
| potential_risks | jsonb | YES | [] | Identified risks |
| code_complexity_metrics | jsonb | YES | {} | Complexity scores |
| compatibility_notes | jsonb | YES | [] | PS version compatibility |
| execution_summary | jsonb | YES | {} | Execution behavior summary |
| analysis_version | varchar(50) | YES | '1.0' | Analysis engine version |

## Field Name Mappings

### Frontend FormData -> Backend req.body

| FormData Key | req.body Field | Type |
|-------------|---------------|------|
| `title` | `title` | string |
| `description` | `description` | string |
| `content` | `content` | string |
| `category_id` | `category_id` | string (numeric) |
| `tags` | `tags` | string (JSON array) |
| `is_public` | `is_public` | string ('true'/'false') |
| `analyze_with_ai` | `analyze_with_ai` | string ('true'/'false') |
| `script_file` | `req.file` (multer) | File object |

### Backend Model -> Database Column

| Model Field | DB Column | Sequelize Mapping |
|------------|-----------|-------------------|
| `userId` | `user_id` | `underscored: true` |
| `categoryId` | `category_id` | `underscored: true` |
| `isPublic` | `is_public` | `underscored: true` |
| `fileHash` | `file_hash` | `field: 'file_hash'` |
| `executionCount` | `execution_count` | `underscored: true` |
| `changelog` | `commit_message` | `field: 'commit_message'` |
| `scriptId` | `script_id` | `field: 'script_id'` |

## Error Handling

| Error | Status | Cause |
|-------|--------|-------|
| `missing_file` | 400 | No file attachment AND no content in FormData |
| `missing_file_content` | 400 | File attachment present but unreadable |
| `duplicate_file` | 409 | MD5 hash matches existing script |
| `file_read_error` | 400 | File content not valid UTF-8 |
| `invalid_content` | 400 | .ps1 file fails PowerShell validation |
| `authentication_required` | 401 | No valid JWT token |
| `server_error` | 500 | Unexpected database or server error |

## Multer Configuration

| Setting | Memory Upload | Disk Upload |
|---------|--------------|-------------|
| Storage | `memoryStorage()` | `diskStorage(./uploads)` |
| Field name | `script_file` | `script_file` |
| Max file size | 10 MB | 20 MB |
| Allowed extensions | .ps1, .psm1, .psd1, .ps1xml, .txt, .json | Same |
| Used when | File < 2MB | File >= 2MB |
