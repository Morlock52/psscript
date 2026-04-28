# Frontend Modernization — Plan 2 (Page Reflow + Legacy Teardown)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap brand routes in BrandShell, migrate the three legacy-Layout-importing pages to the new shell pattern, then delete the legacy `Layout`/`Navbar`/`Sidebar` components, the bespoke `.btn`/`.card`/`.input`/`.glass`/`.markdown-body`/etc. utilities in `index.css`, and the legacy variable shim in `tokens.css`. Leaves the codebase fully on the new token + primitive + shell system.

**Architecture:** Plan 1 introduced tokens, fonts, primitives, and shells but kept legacy machinery alive behind a compatibility shim. Audit (recorded in this plan's "Discovery" section below) shows zero external consumers of the bespoke utilities and only three pages importing the legacy `Layout` wrapper. Plan 2 closes that gap: it wraps the brand routes in `BrandShell` (currently they bypass shells entirely via the `isAuthPage` guard), migrates the three legacy `Layout` pages, then deletes the legacy machinery. After Plan 2, `OperatorShell` and `BrandShell` are the only layout primitives in the tree, the Tailwind shim becomes the only color source (no more `--color-*` aliases), and `index.css` is a small base stylesheet plus a few animation utility classes.

**Tech Stack:** React 18 + Vite + Tailwind + framer-motion + Vitest. No new deps.

---

## Discovery (audit already performed; recorded for the executor)

Run by the plan author against `redesign/2026-04-28-frontend-modernization` HEAD `1d75e8d` (post-Phase-E):

| Selector / pattern                         | Code consumers (`.tsx`/`.ts`) |
|--------------------------------------------|-------------------------------|
| `\.btn[^-a-zA-Z]`, `\.btn-*`               | 0                             |
| `\.card[^-a-zA-Z]`                         | 0                             |
| `\.input[^-a-zA-Z]`                        | 0                             |
| `\.glass[^-a-zA-Z]`                        | 0                             |
| `\.markdown-body`                          | 0                             |
| `surface-primary` / `surface-secondary`    | 0                             |
| `gradient-text`                            | 0                             |
| `animate-fade-in`                          | 2                             |
| `animate-slide-up`                         | 1                             |
| `animate-scale-in`                         | 1                             |
| `animate-pulse`                            | 7                             |
| `skeleton` (CSS class, not the primitive)  | 5                             |
| `import Layout from '../components/Layout'`| 3 (`ChatHistory.tsx`, `LandingPage.tsx`, `ChatWithAI.tsx`) |
| `import Navbar from './components/Navbar'` | 1 (`App.tsx` — unused after Phase E) |
| `import Sidebar from './components/Sidebar'`| 1 (`App.tsx` — unused after Phase E) |

**Implication:** the legacy CSS utilities (.btn, .card, .input, .glass, .markdown-body, surface-*, gradient-text) can be deleted outright. The animations (`animate-*`, `skeleton`) still have consumers; their keyframes need to survive the move from `index.css` to `motion.css` (or stay in place if simpler). The three legacy-Layout pages each need a small migration. App.tsx needs its dead Navbar/Sidebar imports removed and its brand routes wrapped in BrandShell.

---

## File Structure

**Modify:**
- `src/frontend/src/App.tsx` — remove dead Navbar/Sidebar imports; wrap brand routes (`/login`, `/register`, `/auth/callback`, `/pending-approval`, `/landing`, `/404`) in `<BrandShell>` instead of bare `<>{children}</>`.
- `src/frontend/src/pages/LandingPage.tsx` — drop `import Layout` and the `<Layout>` wrapper; let routing-level BrandShell handle chrome.
- `src/frontend/src/pages/ChatHistory.tsx` — drop `import Layout` and the `<Layout>` wrapper; OperatorShell already wraps it at the routing level.
- `src/frontend/src/pages/ChatWithAI.tsx` — same as ChatHistory.
- `src/frontend/src/index.css` — delete bespoke utility blocks: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn:focus-visible`, `.card`, `.card:hover`, `.card-interactive:hover`, `.input`, `.input:hover`, `.input:focus`, `.input::placeholder`, `.divider`, `.surface-primary`, `.surface-secondary`, `.surface-tertiary`, `.surface-elevated`, `.text-primary`, `.text-secondary`, `.text-tertiary`, `.text-muted`, `.glass`, `.gradient-text`, `.markdown-body` and all `.markdown-body *` descendants. Keep: base `body` rule, scrollbar styles, `::selection`, `:focus-visible`, the animation classes (`animate-fade-in`, etc.) and their keyframes (5 still consumed), `.skeleton` (5 consumed), `@media print`.
- `src/frontend/src/styles/tokens.css` — delete the entire legacy compatibility shim block (the `:root { --color-bg-primary: var(--surface-base); ... }` block from the "Legacy variable compatibility shim" header through the end of `:root`). Font tokens (`--font-sans`, `--font-mono`, `--font-display`) and the `body`/`code,kbd,...`/`.tabular-nums` rules added by Phase C **stay**.

**Delete:**
- `src/frontend/src/components/Layout.tsx`
- `src/frontend/src/components/Navbar.tsx` (verify no remaining importers first)
- `src/frontend/src/components/Sidebar.tsx` (verify no remaining importers first)

**Test (extend):**
- `src/frontend/src/components/primitives/__tests__/Tokens.test.tsx` — add a regression test that the legacy shim is gone (`getPropertyValue('--color-bg-primary')` returns empty string after the shim is deleted). This locks the teardown in.

---

## Task L1: Remove dead Navbar/Sidebar imports from App.tsx

**Files:** `src/frontend/src/App.tsx` (modify)

- [ ] **Step 1: Confirm Navbar/Sidebar are truly unreferenced in App.tsx body**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && grep -nE '<Navbar|<Sidebar' src/frontend/src/App.tsx
```

Expected: no matches (Phase E replaced the inline JSX with `<OperatorShell>`).

- [ ] **Step 2: Delete the imports**

In `src/frontend/src/App.tsx`, delete lines 9–10:

```ts
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
```

- [ ] **Step 3: Confirm typecheck still clean**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npx tsc --noEmit 2>&1 | tail -5
```

Expected: empty output (no errors).

---

## Task L2: Wrap brand routes in BrandShell at the AppLayout boundary

**Files:** `src/frontend/src/App.tsx` (modify)

The current `AppLayout` short-circuits brand routes to `<>{children}</>`. Plan 1 task E3 deferred shell-wrapping for these to Plan 2 (per the implementer's report). This task closes that gap.

- [ ] **Step 1: Update the brand-route branch in AppLayout**

Find this block in `src/frontend/src/App.tsx`:

```tsx
const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/auth/callback' || location.pathname === '/pending-approval';

if (isAuthPage) {
  return <>{children}</>;
}
```

Replace it with:

```tsx
const isBrandRoute =
  location.pathname === '/login' ||
  location.pathname === '/register' ||
  location.pathname === '/auth/callback' ||
  location.pathname === '/pending-approval' ||
  location.pathname === '/landing' ||
  location.pathname === '/404';

if (isBrandRoute) {
  return <BrandShell>{children}</BrandShell>;
}
```

The `landing` and `404` additions match the manifest's brand-surface route list.

- [ ] **Step 2: Confirm dev preview boots & brand routes render**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && (lsof -ti :3091 | xargs kill 2>/dev/null; nohup npm run dev -- --port 3091 --host 127.0.0.1 > /tmp/dev-l2.log 2>&1 & echo $! > /tmp/dev-l2.pid); sleep 5; for path in '/' '/login' '/register' '/auth/callback' '/pending-approval' '/404'; do printf "%-22s " "$path:"; curl -fsS -o /dev/null -m 4 -w "%{http_code}\n" http://127.0.0.1:3091${path}; done; kill $(cat /tmp/dev-l2.pid) 2>/dev/null; rm -f /tmp/dev-l2.pid
```

Expected: all return `200`.

---

## Task L3: Migrate LandingPage.tsx off legacy Layout (brand surface)

**Files:** `src/frontend/src/pages/LandingPage.tsx` (modify)

LandingPage is a brand-surface route. After Task L2 it gets `BrandShell` automatically; the inner `<Layout>` wrapper is now redundant (and would produce double chrome).

- [ ] **Step 1: Read the file's current shape**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && head -40 src/frontend/src/pages/LandingPage.tsx
```

- [ ] **Step 2: Remove the Layout import + wrapper**

Delete the line `import Layout from '../components/Layout';`. Find the JSX root `<Layout>...</Layout>` and replace with a fragment `<>...</>` or a `<div>` if the file's structure needs a single child element. The shell wrapper now lives at the route boundary.

- [ ] **Step 3: Confirm LandingPage renders cleanly**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npx tsc --noEmit 2>&1 | tail -5
```

Expected: empty.

---

## Task L4: Migrate ChatHistory.tsx off legacy Layout (operator surface)

**Files:** `src/frontend/src/pages/ChatHistory.tsx` (modify)

ChatHistory is an operator route. `OperatorShell` already wraps it via `AppLayout`; the inner `<Layout>` produces double chrome.

- [ ] **Step 1: Remove import + wrapper**

Delete `import Layout from '../components/Layout';`. Replace the `<Layout>...</Layout>` JSX root with a fragment.

- [ ] **Step 2: Confirm typecheck**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npx tsc --noEmit 2>&1 | tail -5
```

Expected: empty.

---

## Task L5: Migrate ChatWithAI.tsx off legacy Layout (operator surface)

**Files:** `src/frontend/src/pages/ChatWithAI.tsx` (modify)

Same shape as L4.

- [ ] **Step 1: Remove import + wrapper**

Delete `import Layout from '../components/Layout';` and the `<Layout>...</Layout>` JSX root (replace with fragment).

- [ ] **Step 2: Confirm typecheck**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npx tsc --noEmit 2>&1 | tail -5
```

Expected: empty.

---

## Task L6: Delete legacy Layout/Navbar/Sidebar component files

**Files (delete):**
- `src/frontend/src/components/Layout.tsx`
- `src/frontend/src/components/Navbar.tsx`
- `src/frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Verify zero remaining importers**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && grep -rEn "from '.*components/(Layout|Navbar|Sidebar)'|from '\\.\\./components/(Layout|Navbar|Sidebar)'|from '\\./Layout'|from '\\./Navbar'|from '\\./Sidebar'" src/frontend/src 2>&1
```

Expected: only matches inside the legacy files themselves (e.g., `Layout.tsx` importing `./Navbar` — that's fine because the whole file is being deleted). If any consumer outside `Layout.tsx`/`Navbar.tsx`/`Sidebar.tsx` is found, **stop** and report — that consumer must be migrated first.

- [ ] **Step 2: Delete the files**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && git rm src/frontend/src/components/Layout.tsx src/frontend/src/components/Navbar.tsx src/frontend/src/components/Sidebar.tsx
```

- [ ] **Step 3: Confirm typecheck and build still clean**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npx tsc --noEmit 2>&1 | tail -5 && npm run build 2>&1 | tail -3
```

Expected: typecheck empty, build `✓ built in <N>s`.

---

## Task L7: Delete bespoke utility blocks from index.css

**Files:** `src/frontend/src/index.css` (modify)

Delete all utility blocks that have zero consumers (per Discovery audit). **Keep**: base `body` rule, scrollbar styles, `::selection`, `:focus-visible`, animation classes + their keyframes, `.skeleton`, `@media print`.

- [ ] **Step 1: Read current index.css to confirm shape**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && wc -l src/frontend/src/index.css
```

Pre-Plan-2 the file is ~480 lines. After this task, it should be ~180 lines.

- [ ] **Step 2: Delete the unused blocks**

In `src/frontend/src/index.css`, delete these blocks in their entirety (the headers tell you the boundaries):

1. `.surface-primary` / `.surface-secondary` / `.surface-tertiary` / `.surface-elevated` — under `/* Surface variants */`. ~16 lines.
2. `.text-primary` / `.text-secondary` / `.text-tertiary` / `.text-muted` — under `/* Text variants */`. ~16 lines.
3. `.glass` — under `/* Glass effect */`. ~6 lines.
4. `.gradient-text` — under `/* Gradient text */`. ~7 lines.
5. `.card` / `.card:hover` / `.card-interactive:hover` — under `/* Card styles */`. ~16 lines.
6. `.btn` / `.btn:focus-visible` / `.btn-primary` / `.btn-primary:hover` / `.btn-secondary` / `.btn-secondary:hover` / `.btn-ghost` / `.btn-ghost:hover` — under `/* Button base */`. ~50 lines.
7. `.input` / `.input:hover` / `.input:focus` / `.input::placeholder` — under `/* Input styles */`. ~24 lines.
8. `.divider` — under `/* Divider */`. ~7 lines.
9. The entire `/* Markdown Viewer Styles */` block — `.markdown-body` and all `.markdown-body *` rules. ~140 lines.

Do **not** delete the `/* Animation Classes */` block (still 11 consumers) or `.skeleton` (5 consumers).

- [ ] **Step 3: Verify the kept blocks still resolve**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npm run build 2>&1 | tail -3 && grep -cE '^(\.skeleton|@keyframes|\.animate-)' src/index.css
```

Expected: build green; grep returns ≥6 (5 keyframes + a few animate utilities + skeleton).

---

## Task L8: Delete legacy variable shim from tokens.css

**Files:** `src/frontend/src/styles/tokens.css` (modify)

The shim was added at task `a2bb6df` to keep the bespoke utilities in `index.css` rendering after Phase B's deletion of the legacy `:root` palette. With Task L7 those utilities are gone — the shim has no consumers.

- [ ] **Step 1: Identify shim boundaries**

The shim block starts with the comment header `/* Legacy variable compatibility shim — bridges bespoke utilities ... */` and is the FIRST `:root { ... }` block in the file (palette scopes are on `[data-surface]`, not `:root`). After it comes the Phase C font block (also under `:root`, distinct, with its own `--font-sans`/`--font-mono`/`--font-display`).

- [ ] **Step 2: Verify shim block is unconsumed**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && for var in --color-bg-primary --color-text-primary --color-border-default --color-primary --color-success --color-error --shadow-sm --shadow-lg --gradient-primary --glass-bg --space-4 --transition-fast --radius-md --radius-full --blur-md; do
  printf "%-25s " "$var:"
  grep -rE "var\\(\\Q$var\\E\\)" --include='*.tsx' --include='*.ts' --include='*.css' src/frontend/src 2>/dev/null | grep -v "tokens.css" | wc -l
done
```

Expected: every count is `0`. If any is non-zero, that var still has a consumer outside `tokens.css` — report which file:line and ask before proceeding.

- [ ] **Step 3: Delete the shim block**

In `src/frontend/src/styles/tokens.css`, delete from the comment header `/* ============================================================
   Legacy variable compatibility shim ...` through the closing `}` of the `:root` block that defines `--color-*` etc. **Do NOT delete the second `:root` block** (Phase C font tokens — has `--font-sans`, `--font-mono`, `--font-display`).

After deletion, the file's structure should be:
1. `[data-surface="brand"] { ... }`
2. `[data-surface="operator"] { ... }`
3. `[data-surface="operator"][data-theme="light"] { ... }`
4. `@font-face` fallback metric overrides (Phase C)
5. `:root { --font-sans, --font-mono, --font-display }` (Phase C)
6. `body { ... }`, `code, kbd, pre, samp, .font-mono { ... }`, `.tabular-nums { ... }` (Phase C)

Nothing else.

- [ ] **Step 4: Confirm tests still pass and build is clean**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npm run test:run -- src/components/primitives/__tests__/Tokens.test.tsx 2>&1 | tail -5 && npm run build 2>&1 | tail -3
```

Expected: 11/11 tests green; build green.

---

## Task L9: Add regression test that the shim is gone

**Files:** `src/frontend/src/components/primitives/__tests__/Tokens.test.tsx` (modify)

Lock in the teardown so a future "let's add the shim back temporarily" doesn't quietly revive it.

- [ ] **Step 1: Append a new describe block to Tokens.test.tsx**

Add at the bottom of the file (after the `typography cascade integration` describe):

```ts
/*
 * Plan 2 deleted the legacy variable shim. This test locks that in so
 * a future revival is caught.
 */
describe('legacy shim removal', () => {
  const shimVars = [
    '--color-bg-primary',
    '--color-text-primary',
    '--color-border-default',
    '--color-primary',
    '--color-success',
    '--color-error',
    '--shadow-sm',
    '--shadow-lg',
    '--gradient-primary',
    '--glass-bg',
    '--space-4',
    '--transition-fast',
    '--radius-md',
    '--blur-md',
  ];
  shimVars.forEach((name) => {
    it(`legacy shim variable ${name} is no longer defined`, () => {
      const declared = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      expect(declared).toBe('');
    });
  });
});
```

- [ ] **Step 2: Run the test file**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npm run test:run -- src/components/primitives/__tests__/Tokens.test.tsx 2>&1 | tail -5
```

Expected: 25/25 pass (11 existing + 14 new shim-removal cases).

---

## Task L10: Full verification

**Files:** none — verification only.

- [ ] **Step 1: Full Vitest suite**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npm run test:run 2>&1 | tail -10
```

Expected: 15/16 files pass (`AuthContext.test.tsx` pre-existing flake unchanged), 99/106 tests pass (85 from Plan 1 + 14 new shim-removal cases).

- [ ] **Step 2: Build clean**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in <N>s`.

- [ ] **Step 3: Typecheck clean**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npx tsc --noEmit 2>&1 | tail -5
```

Expected: empty.

- [ ] **Step 4: Smoke each surface in dev preview**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && (lsof -ti :3091 | xargs kill 2>/dev/null; nohup npm run dev -- --port 3091 --host 127.0.0.1 > /tmp/dev-l10.log 2>&1 & echo $! > /tmp/dev-l10.pid); sleep 5; for path in '/' '/login' '/dashboard' '/scripts' '/settings/profile' '/landing' '/404'; do printf "%-22s " "$path:"; curl -fsS -o /dev/null -m 4 -w "%{http_code}\n" http://127.0.0.1:3091${path}; done; kill $(cat /tmp/dev-l10.pid) 2>/dev/null; rm -f /tmp/dev-l10.pid
```

Expected: every path returns `200`.

---

## Task L11: Single commit for Plan 2

- [ ] **Step 1: Stage all Plan 2 changes**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && git add src/frontend/src/App.tsx src/frontend/src/pages/LandingPage.tsx src/frontend/src/pages/ChatHistory.tsx src/frontend/src/pages/ChatWithAI.tsx src/frontend/src/index.css src/frontend/src/styles/tokens.css src/frontend/src/components/primitives/__tests__/Tokens.test.tsx && git status --short
```

Expected:
```
M  src/frontend/src/App.tsx
M  src/frontend/src/pages/LandingPage.tsx
M  src/frontend/src/pages/ChatHistory.tsx
M  src/frontend/src/pages/ChatWithAI.tsx
D  src/frontend/src/components/Layout.tsx
D  src/frontend/src/components/Navbar.tsx
D  src/frontend/src/components/Sidebar.tsx
M  src/frontend/src/index.css
M  src/frontend/src/styles/tokens.css
M  src/frontend/src/components/primitives/__tests__/Tokens.test.tsx
```

- [ ] **Step 2: Commit**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && git commit -m "$(cat <<'EOF'
feat(redesign): reflow brand routes onto BrandShell, retire legacy machinery

Plan 2 of the 2026-04-28 frontend modernization. Wraps brand routes
(/login, /register, /auth/callback, /pending-approval, /landing, /404)
in BrandShell at the AppLayout boundary. Migrates the three pages still
importing the legacy Layout component (LandingPage, ChatHistory,
ChatWithAI) to drop their inner Layout wrapper — shells now live at the
route boundary.

Deletes the legacy machinery once consumers are gone:
- src/frontend/src/components/Layout.tsx
- src/frontend/src/components/Navbar.tsx
- src/frontend/src/components/Sidebar.tsx
- bespoke utility blocks in src/frontend/src/index.css (.btn, .card,
  .input, .glass, .markdown-body, .surface-*, .gradient-text, .text-*,
  .divider) — none of which have any external consumer per audit.
- legacy variable compatibility shim in src/frontend/src/styles/tokens.css
  (the :root { --color-*, --shadow-*, --gradient-*, --glass-*, --space-*,
  --transition-*, --radius-*, --blur-* } block added at a2bb6df)

Adds a 14-case regression test in Tokens.test.tsx that asserts the
shim variables are gone — locks the teardown in.

After Plan 2, OperatorShell + BrandShell are the only layout primitives
in the tree, the Tailwind shim is the only color source, and index.css
is a small base stylesheet plus the still-consumed animation utilities
and .skeleton class.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)" && git log --oneline -3
```

---

## Self-Review

- **Spec coverage:** Plan 2's brief from the design spec is "reflow the 36 routes onto the new system + delete legacy machinery." Audit shows 36 routes already split correctly — operator routes are already wrapped by `OperatorShell` (Phase E E3); brand routes are not (deferred to this plan). Tasks L2 + L3 cover the gap. Bespoke utility deletion is covered by L7. Variable shim deletion is L8. Component file deletion is L6. Test regression is L9. All boxes ticked.
- **Placeholder scan:** every step has exact paths, exact commands, exact expected output. No "implement appropriately" or "similar to above". Code-deletion tasks identify the blocks by header comment and line-count expectation rather than verbatim source (the source is in the file; pasting it would just duplicate).
- **Type consistency:** Plan 2 adds no new types. The `BrandShell` API used in L2 (`<BrandShell>{children}</BrandShell>`) matches the signature defined in Plan 1 task E1.
- **Risk:** the heaviest task is L7 (delete utility blocks). The audit shows zero consumers, but if a stray consumer exists in JSX as `className={\`card${suffix}\`}` style template literals, the audit's regex (`\.card[^-a-zA-Z]`) might miss it. L10 step 4 (curl smoke) catches catastrophic visual regressions; Plan 3's visual diff is the comprehensive net.

---

## Execution Handoff

After Plan 2's L11 commit, the redesign branch will have 9 functional commits ahead of main and the codebase will be fully on the new system. Plan 3 (verification — visual diff, a11y sweep, perf budget) is the final plan; it adds no new product code, only verification artifacts.

**Two execution options:**

1. **Subagent-Driven** — `superpowers:subagent-driven-development`. Best when the plan's tasks are independent enough to dispatch separately. For Plan 2, most tasks share `App.tsx` or `index.css` and the work is short — subagent ceremony has less ROI here.

2. **Inline Execution** — `superpowers:executing-plans`. Better fit for this plan's tight, mechanical scope. Recommended.
