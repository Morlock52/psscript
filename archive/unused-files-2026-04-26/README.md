# Unused File Archive - 2026-04-26

This archive contains older, duplicate, or generated files that were cluttering the active repo layout. Original paths are preserved under this directory so any item can be restored with `git mv archive/unused-files-2026-04-26/<original-path> <original-path>`.

Active canonical files remain in their normal project locations. No runtime source, current README screenshots, Supabase migrations, Netlify configuration, or active test specs were intentionally moved here.

## Selection Rules

- Finder-style duplicate files ending in ` (1)` were archived when an active canonical path existed or the file was clearly a stale one-off copy.
- Generated QA screenshots, Browser/Playwright CLI page snapshots, and console logs were archived because current validation artifacts now live in docs or can be regenerated.
- Backup/source snapshot files ending in `.bak` were archived because active TypeScript source files are present in the original locations.
- Generated or empty placeholders were archived when the active README/docs no longer reference them.

## Archived Groups

| Group | Files | What They Were Used For | Why Archived |
| --- | ---: | --- | --- |
| `.claude/` | 1 | Duplicate local Claude settings snapshot. | Active `.claude/settings.local.json` remains in place. |
| `.playwright-cli/` | 19 | Browser/Playwright CLI page snapshots and console logs from March-April 2026 manual QA sessions. | Historical debugging artifacts; not part of current automated test inputs. |
| `assets/images/` | 1 | Empty `dashboard.png` placeholder. | README now uses checked-in screenshots under `docs/screenshots/` and framed previews under `docs/screenshots/readme/`. |
| `db-backups/` | 1 | Data-maintenance smoke-test backup JSON. | Test artifact from a prior smoke run; not needed for app startup or tests. |
| `demos/` | 4 | Duplicate voice API demo HTML/JS files. | Canonical demo files without ` (1)` remain in `demos/`. |
| `docs/` | 139 | Duplicate historical reports, plans, training docs, and generated HTML exports. | Canonical docs remain in `docs/`; generated exports can be rebuilt. |
| `docs-site/` | 10 | Duplicate generated docs-site screenshot build outputs. | Build output only; canonical screenshots remain in `docs/screenshots/` and docs-site source assets. |
| `output/` | 8 | Local Playwright/browser screenshots from older login, dashboard, and data-maintenance debugging. | Canonical documentation screenshots now live under `docs/screenshots/`. |
| `retired/docker/` | 7 | Duplicate Docker retirement docs and generated HTML exports. | Docker docs are already retired; duplicate ` (1)` copies are not active. |
| `scripts/` | 20 | Duplicate one-off setup, capture, reset, deploy, and maintenance helper scripts. | Canonical helper scripts remain in `scripts/` where still relevant. |
| `src/` | 4 | Old mock AI service copy, uploaded PowerShell sample duplicate, and `.bak` source snapshots. | Active source files and current test fixtures remain in place. |
| `tests/` | 3 | Duplicate E2E specs with ` (1)` suffixes. | Canonical E2E specs remain in `tests/e2e/`. |

Total archived non-inventory files: 217.

## Notes

- The archive keeps file contents available for audit/history, but these paths should not be imported or linked from active code.
- If a file is needed again, restore it deliberately and update references to point at the restored active path.
- New generated screenshots should be written to the current documented locations, not to this archive.
