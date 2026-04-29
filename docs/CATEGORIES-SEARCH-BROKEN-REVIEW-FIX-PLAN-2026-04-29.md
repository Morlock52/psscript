# Categories and Search Broken Review and Fix Plan

Date: 2026-04-29
Production URL: https://pstest.morloksmaze.com
Scope: `/search`, `/categories`, category browse, category settings counts, and hosted `/api/scripts/search`.

## Current Verdict

Categories and search are still broken in production from the user-facing navigation.

The previous backend/API patch made the hosted search endpoint capable of answering category and search queries, but the frontend app never mounts the `/search` or `/categories` pages. The sidebar links exist, but the React router sends both paths to the wildcard fallback and redirects to `/404`.

## Evidence

### Browser evidence

Using the Browser Use in-app browser, the login page loaded and exposed the expected DOM. Browser Use could inspect the page state, but its click translation failed on the default login button, so I used a local Playwright browser pass for the live authenticated route checks.

Authenticated production checks:

```text
/search     -> https://pstest.morloksmaze.com/404
/categories -> https://pstest.morloksmaze.com/404
```

Observed page content:

```text
404
Page Not Found
The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
```

### Code evidence

`src/frontend/src/components/layouts/Sidebar.tsx` links to:

```ts
{ to: '/search', label: 'Search' },
{ to: '/categories', label: 'Categories' },
```

`src/frontend/src/App.tsx` does not import or route the existing pages:

```text
src/frontend/src/pages/Search.tsx
src/frontend/src/pages/Categories.tsx
```

The router has script routes, AI routes, documentation routes, and settings routes, but no:

```text
/search
/categories
/categories/:id
```

The wildcard route catches those paths and sends them to `/404`.

### API evidence

The API now responds:

```text
GET /api/scripts/search?q=process&limit=5&sort=relevance -> 200
GET /api/categories -> 200 and includes scriptCount
GET /api/scripts/search?category_id=3&limit=10 -> 200
```

So the main current break is frontend route wiring. There are also secondary quality issues that should be fixed in the same pass because they will make the mounted pages look partially broken.

## Internet Research Used

### Supabase / Postgres

Supabase recommends Postgres full-text search for database-backed search, including `tsvector` documents, generated searchable columns, and GIN indexes for performance. It also documents `websearch_to_tsquery()` as suitable for user-facing search syntax.

Source: https://supabase.com/docs/guides/database/full-text-search

PostgreSQL documents `websearch_to_tsquery`, `ts_rank`, and `ts_rank_cd` for text-search matching and ranking. This supports keeping search in hosted Supabase Postgres rather than adding a separate search service for the current scale.

Source: https://www.postgresql.org/docs/current/functions-textsearch.html

### UX Research

Baymard's search/category guidance says search should guide users to matching category scopes when relevant. For PSScript, that means category browse and search filtering should be one connected discovery experience, not two disconnected pages.

Source: https://baymard.com/blog/autodirect-searches-matching-category-scopes

NN/g's search guidance emphasizes visible, simple search access. For PSScript, the sidebar Search link must actually land on a working search page, and the search box should remain obvious and directly usable.

Source: https://www.nngroup.com/articles/search-visible-and-simple/

## Findings

### Finding 1 - Sidebar links point to unmounted routes

Severity: P1

User impact:

- Clicking Search from the main navigation lands on 404.
- Clicking Categories from the main navigation lands on 404.
- Users correctly experience both features as broken even though the underlying API can respond.

Root cause:

- `Search.tsx` and `Categories.tsx` exist but are not lazy imported or routed in `App.tsx`.

Fix:

- Add lazy imports:
  - `const Search = lazyWithRetry(() => import('./pages/Search'));`
  - `const Categories = lazyWithRetry(() => import('./pages/Categories'));`
- Add protected routes:
  - `/search`
  - `/categories`
  - `/categories/:id`

Verification:

- Browser check `/search` shows search UI, not 404.
- Browser check `/categories` shows category browse UI, not 404.
- Sidebar click checks navigate to those pages without fallback.

### Finding 2 - Category selection does not update URL or support deep links fully

Severity: P2

User impact:

- A category can be selected, but the URL does not reflect it.
- Sharing or refreshing a selected category workflow is weak.

Root cause:

- `Categories.tsx` reads `categoryId` from `useParams`, but `handleCategorySelect()` only updates local state.

Fix:

- Use `useNavigate()`.
- On category click, navigate to `/categories/${category.id}`.
- Keep `/categories` as the empty category selection state.
- When `categoryId` changes, select the matching category from loaded data.

Verification:

- Click a category; URL becomes `/categories/:id`.
- Refresh; the same category remains selected.
- Invalid category id shows a clear "category not found" state.

### Finding 3 - Category page analysis score mapping is wrong

Severity: P2

User impact:

- Quality score can show `N/A` or wrong red/yellow state despite analysis existing.

Root cause:

- `Categories.tsx` reads `script.analysis?.code_quality_score`.
- Hosted API search results return `analysis.quality_score` and `analysis.qualityScore`.

Fix:

- Normalize a helper:

```ts
const getQualityScore = (script: Script) =>
  script.analysis?.quality_score ?? script.analysis?.qualityScore ?? script.analysis?.code_quality_score;
```

- Use this helper for category and search result cards.

Verification:

- Category browse and search show the same quality score for the same script.
- No analyzed script shows `N/A` only because of naming mismatch.

### Finding 4 - Search page does not preserve query state in URL

Severity: P2

User impact:

- Search/filter state is lost on refresh.
- Search results cannot be shared.
- Browser back/forward does not map cleanly to previous searches.

Root cause:

- `Search.tsx` keeps all filters in component state.
- It does not read or write `URLSearchParams`.

Fix:

- Make URL query params the source of truth:
  - `q`
  - `category_id`
  - `tags`
  - `sort`
  - `mine`
  - `view`
- Update the URL on form submit and filter changes.
- Read initial state from `useSearchParams()`.

Verification:

- `/search?q=process&category_id=3` opens with controls populated.
- Refresh preserves filters.
- Back/forward restores prior search states.

### Finding 5 - Search result count is not a real total

Severity: P2

User impact:

- The UI says "Showing X of X" even when more pages exist.
- Future pagination would be incorrect.

Root cause:

- `handleScriptSearch()` returns `total: scripts.length`.
- It does not run a total count query or use `COUNT(*) OVER()`.

Fix:

- Update API search SQL to return `COUNT(*) OVER() AS total_count`.
- Map `total` from the first row total or `0`.
- Keep `limit` and `offset` in the response.

Verification:

- `limit=1` can return `scripts.length === 1` and `total > 1` when more matches exist.

### Finding 6 - Search and category pages duplicate script result UI

Severity: P3

User impact:

- Same script can look different across Scripts, Search, and Categories.
- Bugs like `quality_score` vs `code_quality_score` recur.

Root cause:

- `Search.tsx`, `Categories.tsx`, and `ScriptManagement.tsx` each render their own result rows/cards.

Fix:

- Create or reuse a `ScriptResultCard` and a `ScriptResultTable`.
- Normalize script fields once:
  - title
  - description
  - category
  - author
  - quality score
  - updated date
  - execution count

Verification:

- Search and category pages render the same metadata for the same script.
- Unit tests cover missing category, missing analysis, and analyzed script states.

## Fix Plan

### Phase 1 - Restore routes

Files:

- `src/frontend/src/App.tsx`

Work:

- Import `Search` and `Categories`.
- Add protected routes for `/search`, `/categories`, and `/categories/:id`.

Tests:

- Add route smoke assertions or Playwright smoke:
  - `/search` is not 404.
  - `/categories` is not 404.

### Phase 2 - Make category browse reliable

Files:

- `src/frontend/src/pages/Categories.tsx`

Work:

- Add `useNavigate`.
- Navigate to `/categories/:id` on category select.
- Handle invalid category ids.
- Normalize quality score mapping.
- Show category counts next to category names using `scriptCount`.

Tests:

- Category select changes URL.
- Refresh on `/categories/:id` restores category.
- Category result rows all match selected category.

### Phase 3 - Make search state durable

Files:

- `src/frontend/src/pages/Search.tsx`

Work:

- Use `useSearchParams`.
- Map URL params to filter controls.
- Update params on submit/reset/filter changes.
- Keep `view` in URL or local storage.
- Show applied filter chips.

Tests:

- `/search?q=process` opens with the query field populated.
- Selecting a category updates `category_id` in the URL.
- Reset clears URL filters.

### Phase 4 - Fix total counts and pagination foundation

Files:

- `netlify/functions/api.ts`

Work:

- Add `COUNT(*) OVER() AS total_count` to hosted search.
- Return real `total`.
- Keep existing Supabase/Postgres FTS, category, tag, mine, and sort filters.

Tests:

- `limit=1` returns one script but `total` reflects all matches.
- Category filter total matches category count for empty query.

### Phase 5 - Consolidate result presentation

Files:

- `src/frontend/src/components/ScriptCard.tsx` or new `ScriptResultCard.tsx`
- `src/frontend/src/pages/Search.tsx`
- `src/frontend/src/pages/Categories.tsx`

Work:

- Reuse one card/list component.
- Normalize analysis score access.
- Avoid broad ad hoc display logic.

Tests:

- Search and category pages render same title/category/quality values for the same fixture.

## Acceptance Criteria

- Sidebar Search opens `/search` and never redirects to `/404`.
- Sidebar Categories opens `/categories` and never redirects to `/404`.
- `/categories/:id` deep links to the selected category.
- Search query, category, tags, sort, and mine filters survive refresh.
- Category browse results use the same hosted `/api/scripts/search` contract.
- Search API returns a real `total`, not just page length.
- Browser smoke proves:
  - login
  - open Search
  - search a known script title
  - filter by category
  - open Categories
  - select the same category
  - verify only matching scripts appear

## Recommended Next Step

Implement Phase 1 and Phase 2 first. Those two phases address the user-visible break immediately. Then implement Phase 3 and Phase 4 in the same branch before redeploy, because durable URL state and real totals are what make search feel correct instead of just technically reachable.

## Implemented Fixes and Verification Results

Date completed: 2026-04-29

### Code changes completed

- Mounted the existing Search and Categories pages in `src/frontend/src/App.tsx`.
- Added protected routes for `/search`, `/categories`, and `/categories/:id`.
- Updated category browsing so category selection navigates to `/categories/:id`.
- Added category deep-link restore and invalid-category handling.
- Displayed category `scriptCount` values when the hosted API provides them.
- Normalized analysis quality score display across category and search results.
- Moved Search page state into URL params for `q`, `category_id`, `tags`, `sort`, `mine`, and `view`.
- Replaced raw result anchors with React Router links.
- Updated hosted `/api/scripts/search` to return `COUNT(*) OVER() AS total_count`.
- Kept the hosted API response shape backward compatible as `{ scripts, total, filters }`.

### Local verification

```text
npm run build
Result: passed

/Users/morlock/node_modules/.bin/esbuild netlify/functions/api.ts --bundle --platform=node --format=esm --outfile=/tmp/psscript-netlify-api-check.mjs
Result: passed

npm run test:run -- --pool=forks --maxWorkers=1 src/api/__tests__/hostedAiClient.test.ts src/contexts/__tests__/AuthContext.test.tsx
Result: passed, 2 files, 21 tests
```

### Production deployment

```text
Production URL: https://pstest.morloksmaze.com
Unique deploy URL: https://69f1df48242141400a013fd2--psscript.netlify.app
Deploy ID: 69f1df48242141400a013fd2
Build logs: https://app.netlify.com/projects/psscript/deploys/69f1df48242141400a013fd2
```

Netlify Lighthouse plugin result for `/`:

```text
Performance: 40
Accessibility: 100
Best Practices: 100
SEO: 81
PWA: 30
```

### Production smoke verification

Browser Use could not control the Codex in-app browser directly because Computer Use is blocked from the Codex app, so the same browser lifecycle was verified with Playwright.

```text
/search?q=process -> not 404
Search query field populated from q=process
/api/scripts/search?q=process&limit=1&sort=relevance -> 200
Search API returned scripts.length <= 1 and total = 2
/api/categories -> 200 with scriptCount fields
/search?category_id=3&view=list -> not 404
Search category select populated from category_id=3
/api/scripts/search?category_id=3&limit=10 -> 200
/categories -> not 404
/categories/3 -> not 404
Refresh on /categories/3 preserved the selected category route
/scripts/4 from search results -> not 404
```

### Remaining notes

- The smoke category used `Automation` (`id=3`) because the current production category list returned no category with `scriptCount > 0`. The category filter API still returned 200 and scoped an empty result correctly.
- The Netlify Lighthouse Performance score is still low at 40. That is outside this category/search functional repair and should be tracked as a separate performance task.
