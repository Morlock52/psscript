# Module 02: Script Lifecycle

## Objectives

- Upload scripts and validate metadata
- Apply categories and tags
- Understand versioning and integrity checks

## Walkthrough

1. Navigate to Scripts and select Upload.
2. Upload a PowerShell script from `test-script.ps1` or create a new file.
3. Add tags and a category, then save.
4. Open the script detail page and review metadata.

## Lifecycle snapshot

![Script Lifecycle](../../graphics/lifecycle.svg)

## Screenshots

![Script Upload](../../screenshots/upload.png)

![Script Detail](../../screenshots/script-detail.png)

## Metadata checklist

| Field | Example | Notes |
| --- | --- | --- |
| Title | Reset-UserPassword | Use Verb-Noun naming |
| Description | Reset AD user password | Keep it concise |
| Category | Identity | Match existing taxonomy |
| Tags | security,active-directory | 2-5 meaningful tags |
| Owner tag | owner:team-identity | Use a consistent owner tag |
| Hash | auto | Calculated on upload |

## Integrity and deduplication

- The backend calculates a file hash on upload.
- Duplicate uploads are detected and blocked or flagged.

## Verification checklist

- Upload succeeds and the script appears in the list.
- Tags and category are visible on the card and detail page.
- The script detail page shows a security and quality score.
