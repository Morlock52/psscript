# PSScript Script App Review: 20 Important Improvements

Date: 2026-04-29
Production URL reviewed: https://pstest.morloksmaze.com
Review method: Browser Use live DOM review, production route checks, repository inspection, and current project MD review artifacts.

## Review Summary

The script lifecycle is stronger after the recent category/search repairs, but the app still has several high-value improvement opportunities around reliability, script data hygiene, analysis trust, lifecycle clarity, and production observability.

The most important live observation is that Browser Use initially saw the authenticated dashboard and working search surface, but later the same in-app browser session showed several protected pages stuck at `Loading PSScript...` with only the shell and Voice button visible. Earlier production smoke checks verified those routes with Playwright, so this should be treated as a session/loading resilience issue rather than proof that every route is globally down.

The list below is ordered by practical impact on the script management product.

## 20 Improvements

### 1. Add a hard timeout and recovery state for app bootstrap loading

Priority: P1

Evidence:

- Browser Use saw `/login`, `/search`, `/categories`, `/scripts/4`, and `/scripts/upload` render only `Loading PSScript...` plus the shell after the session changed state.
- No browser console errors were exposed through Browser Use during that stuck state.

Why it matters:

- A user should never be left with an indefinite loading screen.
- If auth, profile fetch, chunk loading, or API startup fails, the UI needs to say which subsystem failed and offer a retry/sign-out path.

Recommended fix:

- Add an app bootstrap watchdog around auth/profile initialization.
- After 8-12 seconds, show a recoverable state with `Retry`, `Go to Login`, and `Clear local session` actions.
- Log a structured client event containing route, auth state, profile fetch state, chunk load status, and request id.

Validation:

- Simulate failed `/api/auth/me`.
- Simulate stale/invalid Supabase token.
- Simulate lazy chunk load failure.
- Verify no route stays on `Loading PSScript...` indefinitely.

### 2. Clean production test data from the primary workspace

Priority: P1

Evidence:

- Dashboard showed scripts named `E2E Script ...` and `Smoke Upload ...`.
- Search tags included `codex-smoke`, `delete-test`, and `readme-screenshot`.
- Dashboard metrics displayed `Total Scripts 0` while recent scripts were visible.

Why it matters:

- Test data makes production look untrustworthy.
- It can distort search, category counts, dashboard metrics, and README screenshots.

Recommended fix:

- Add a `test_data` marker column or metadata tag for generated smoke-test records.
- Keep test records hidden from normal user views by default.
- Add an admin-only cleanup job that removes smoke data by explicit marker, not fuzzy title matching.

Validation:

- Create a marked smoke script.
- Confirm it is visible only in test/admin diagnostics.
- Confirm dashboard counts and search results exclude it by default.

### 3. Fix dashboard metric consistency

Priority: P1

Evidence:

- Browser Use saw `Total Scripts 0`, `AI Analyses 0`, and `Avg. Security Score 0.0`, while the same dashboard listed recent scripts.

Why it matters:

- Conflicting metrics make admins doubt the database and analysis pipeline.

Recommended fix:

- Make dashboard cards use the same hosted, ownership-aware script source as recent scripts.
- Add explicit empty, loading, and error states per card.
- Include last refreshed time and source endpoint in a dev/admin-only diagnostic tooltip.

Validation:

- Seed known scripts and analyses.
- Verify dashboard totals match `/api/scripts` and `/api/analytics/*`.

### 4. Replace fake recent activity with real audit events

Priority: P1

Evidence:

- Dashboard showed activity rows like `updated Example Script 0` and `created Example Script 4`.

Why it matters:

- Fake activity in production is misleading and can hide actual operational events.

Recommended fix:

- Back recent activity with an `audit_events` table or existing event source.
- Emit events for upload, edit, analysis start/complete/fail, export, delete, category change, and login approval.
- Show an honest empty state when there are no events.

Validation:

- Upload, analyze, export, and delete a script.
- Confirm matching audit events appear with real script ids, actor ids, and timestamps.

### 5. Normalize all script date fields

Priority: P1

Evidence:

- Dashboard script cards showed `Unknown date` for several scripts.
- Search results for the same app showed valid updated dates.

Why it matters:

- Script lifecycle review depends on knowing when a script was created, changed, analyzed, and deleted.

Recommended fix:

- Normalize `createdAt`, `updatedAt`, `created_at`, and `updated_at` in one frontend adapter.
- Use that adapter across dashboard, script management, search, categories, details, and analysis pages.
- Add a visible fallback only when both created and updated dates are missing.

Validation:

- Feed both snake_case and camelCase fixture payloads.
- Verify all script cards render the same date.

### 6. Add a single script result presentation component

Priority: P2

Evidence:

- Search, categories, dashboard, and script management still render script rows/cards separately.
- Recent repairs had to normalize quality score fields in more than one page.

Why it matters:

- Duplicated presentation code causes repeated bugs in score, date, category, author, and delete behavior.

Recommended fix:

- Introduce a shared `ScriptResultCard` and `ScriptResultRow`.
- Feed both from one normalized `ScriptSummary` model.
- Keep page-specific actions as slots/props.

Validation:

- Snapshot-test one normalized script fixture across search, category, and dashboard views.

### 7. Add a script lifecycle status model

Priority: P2

Evidence:

- The UI has upload, analysis, export, delete, and version history, but no single lifecycle state.

Why it matters:

- Users need to know whether a script is uploaded, analyzed, stale after edit, exported, archived, deleted, or awaiting review.

Recommended fix:

- Add computed lifecycle states: `uploaded`, `analyzing`, `analyzed`, `analysis_failed`, `stale_analysis`, `archived`, `deleted`.
- Display the state consistently on cards, detail pages, and analysis pages.

Validation:

- Edit an analyzed script and confirm it becomes `stale_analysis`.
- Rerun analysis and confirm it becomes `analyzed`.

### 8. Improve script delete UX with exact consequences

Priority: P2

Evidence:

- Delete exists in multiple places, including dashboard cards.
- Prior work focused on exact backend delete reporting.

Why it matters:

- Script deletion is high-risk and should show what will be removed and what will remain.

Recommended fix:

- Before delete, show title, id, owner, analysis count, versions count, and whether embeddings/audit records remain.
- After delete, show exact backend result: deleted ids and not-deleted ids.

Validation:

- Try owner delete, admin delete, and unauthorized delete.
- Confirm UI mirrors backend result exactly.

### 9. Add archive/restore before permanent delete

Priority: P2

Evidence:

- Users have repeatedly asked not to delete project artifacts and to archive old files instead.
- Script lifecycle currently treats delete as the primary removal path.

Why it matters:

- Production script management usually needs reversible retirement before destructive removal.

Recommended fix:

- Add `archived_at`, `archived_by`, and optional `archive_reason`.
- Default UI action should be Archive.
- Keep permanent Delete admin-only and visually separated.

Validation:

- Archive a script.
- Confirm normal lists hide it and admin archive view can restore it.

### 10. Make category assignment part of upload and post-upload review

Priority: P2

Evidence:

- Search results showed useful scripts as `Uncategorized`.
- Categories exist, but production category counts were all zero in the Browser Use/production smoke category sample.

Why it matters:

- Categories are only useful if scripts reliably land in them.

Recommended fix:

- Keep category selection in upload.
- Add AI-suggested category after analysis with a one-click accept action.
- Add an uncategorized queue in Settings or Scripts.

Validation:

- Upload without category.
- Run analysis.
- Confirm suggested category appears and accepting it updates search/category counts.

### 11. Add script tagging governance

Priority: P2

Evidence:

- Search exposed test-oriented tags such as `delete-test`, `codex-smoke`, and `readme-screenshot`.

Why it matters:

- Tags are discovery metadata; uncontrolled tags quickly become noise.

Recommended fix:

- Add tag normalization, tag merge, hidden/system tags, and admin tag cleanup.
- Mark smoke/test tags as system-only and hide them from normal search filters.

Validation:

- Create duplicate tags with case differences.
- Confirm canonicalization and search filter behavior.

### 12. Add analysis confidence explanations

Priority: P2

Evidence:

- The analysis schema includes criteria version and confidence.
- The UI uses scores but does not make confidence meaning obvious across the script lifecycle.

Why it matters:

- A score without confidence can look more authoritative than it is.

Recommended fix:

- Display confidence next to score groups with short language: `High confidence`, `Needs manual review`, or `Fallback static analysis`.
- Distinguish AI provider results from deterministic fallback results.

Validation:

- Force static fallback.
- Confirm the UI labels the result honestly.

### 13. Add stale-analysis detection after edits

Priority: P2

Evidence:

- The backend has script versioning.
- The UI can show analysis and script content, but stale status needs to be explicit after edits.

Why it matters:

- Users may trust an old analysis that no longer matches the current script content.

Recommended fix:

- Store `analysis.script_version` or `analysis.file_hash`.
- Compare it to current script version/hash.
- Warn when analysis is stale and offer rerun.

Validation:

- Analyze a script.
- Edit content.
- Confirm the analysis page warns before showing old findings.

### 14. Add command-level risk badges to search/list cards

Priority: P3

Evidence:

- Analysis includes command details and risk categories.
- Search cards currently show only broad quality score.

Why it matters:

- Search should help users identify risky scripts before opening each detail page.

Recommended fix:

- Surface compact badges such as `Deletes files`, `Downloads remote content`, `Changes users`, `Uses remoting`, or `Requires admin`.
- Derive from saved command details and static fallback detectors.

Validation:

- Upload scripts containing `Remove-Item`, `Invoke-WebRequest`, and `New-ADUser`.
- Confirm badges appear in search and script management.

### 15. Add saved searches and review queues

Priority: P3

Evidence:

- Search now supports durable URL params.
- There is no visible saved search/review queue workflow.

Why it matters:

- Admins need repeated views like `high risk`, `uncategorized`, `not analyzed`, and `stale analysis`.

Recommended fix:

- Add saved server-side filters for common queues.
- Start with built-in queues before custom user-created saved searches.

Validation:

- Create scripts matching each queue.
- Confirm counts and URL params stay stable.

### 16. Add script owner and approval workflow

Priority: P3

Evidence:

- Scripts show owner/author but do not show approval status.

Why it matters:

- A central script repository needs a path from uploaded draft to approved operational script.

Recommended fix:

- Add statuses: `draft`, `needs_review`, `approved`, `rejected`, `retired`.
- Require reviewer notes when approving or rejecting.

Validation:

- Upload a script as a normal user.
- Confirm admin can approve/reject and that the status appears in lists.

### 17. Add semantic duplicate and near-duplicate review

Priority: P3

Evidence:

- Exact duplicate detection exists through file hash.
- The product also stores embeddings.

Why it matters:

- Script libraries often contain near-duplicates with renamed variables or small edits.

Recommended fix:

- Use existing embeddings to show `possibly similar scripts` during upload and on detail pages.
- Separate exact hash duplicate from semantic near-duplicate.

Validation:

- Upload a lightly modified copy of an existing script.
- Confirm the UI flags it as similar without blocking upload.

### 18. Add export package for script review evidence

Priority: P3

Evidence:

- PDF analysis export exists.
- Users need a complete evidence package for review and training.

Why it matters:

- Security review often requires script source, analysis, findings, remediation plan, version history, and audit trail together.

Recommended fix:

- Add a `Download review package` action that exports PDF plus JSON metadata and script source in a zip.
- Keep PDF as the human-readable artifact.

Validation:

- Export a package.
- Confirm it contains source, analysis PDF, criteria version, version history, and audit summary.

### 19. Add production diagnostics for route health

Priority: P2

Evidence:

- Recent work fixed `/search` and `/categories` route misses.
- Browser Use later saw route content stuck behind `Loading PSScript...`.

Why it matters:

- Route regressions should be caught before users report them.

Recommended fix:

- Add a synthetic smoke script that checks `/`, `/login`, `/dashboard`, `/scripts`, `/search`, `/categories`, `/scripts/upload`, and a known detail page.
- Store status, deploy id, and response screenshot/DOM excerpt.

Validation:

- Run after every Netlify deploy.
- Fail the deploy pipeline or create an alert if a protected route renders only the shell.

### 20. Track Lighthouse and bundle performance as a separate quality gate

Priority: P3

Evidence:

- Latest Netlify Lighthouse plugin result for `/` reported Performance `40`.
- Build output includes large vendor chunks, including Monaco and syntax highlighting bundles.

Why it matters:

- Slow startup increases the odds of perceived loading failures and reduces trust in the management console.

Recommended fix:

- Lazy-load heavy editor/highlight/Monaco paths only on pages that need them.
- Add route-level performance budgets for dashboard, search, upload, and analysis.
- Track Largest Contentful Paint, Total Blocking Time, and JS transfer size per deploy.

Validation:

- Re-run Lighthouse after code splitting.
- Confirm dashboard and search bundles do not include editor-only dependencies.

## Recommended Implementation Order

1. Fix indefinite loading recovery and route diagnostics.
2. Clean and isolate production test data.
3. Normalize script summary data once and reuse it across dashboard, search, categories, and script management.
4. Add lifecycle states, stale-analysis detection, and archive/restore.
5. Improve review workflows: approval status, saved queues, semantic duplicates, and evidence packages.
6. Address performance as its own pass after behavior is reliable.

## Acceptance Criteria for the Next Repair Pass

- No route can remain indefinitely on `Loading PSScript...`.
- Production dashboard metrics match visible script data.
- Test/smoke records are hidden from standard script views.
- Every script card uses the same title, owner, date, category, status, and quality-score adapter.
- Script analysis clearly shows whether it is current, stale, AI-generated, or static fallback.
- Archive is the default safe removal flow; delete remains explicit and exact.
- Post-deploy smoke checks cover all primary script lifecycle routes.
