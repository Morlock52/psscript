# Frontend Modernization — Plan 3 (Verification)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for tasks V1–V3 (mechanical, fast). V4 (visual diff sweep) is human-in-loop and intentionally deferred to merge time.

**Goal:** Verify the redesign branch (Plans 1+2) is merge-ready: tests green, build green, bundle size within budget, accessibility audited, visual regressions either intentional or filed.

**Architecture:** Plan 1 introduced foundation, Plan 2 reflowed pages and tore down legacy machinery. Plan 3 produces the verification artifacts that decide merge-readiness. Most of Plan 3 is mechanical (run things, record results); one task (V4 visual diff) is necessarily human-in-loop because the redesign IS a visual change — most route diffs will be huge mismatches by design, and a human has to triage which mismatches are intended vs. regressions.

**Tech Stack:** Vitest + Playwright + pixelmatch + @axe-core/playwright (already installed).

---

## Discovery

Branch state at the start of Plan 3:

| Item | State |
|------|-------|
| Branch | `redesign/2026-04-28-frontend-modernization` |
| Commits ahead of main | 10 (Plan 1: 8, Plan 2: 2 incl. plan commit) |
| Tests on primitives + layouts | 60/60 green |
| Token tests | 25/25 green |
| Build | clean |
| Typecheck | clean |
| Pre-existing flake | `AuthContext.test.tsx` (vitest worker timeout, predates redesign) |
| Visual baseline | `tests/visual/__baseline__/` 136 PNGs (pre-redesign main) |

---

## File Structure

**Created (verification artifacts):**
- `tests/visual/PLAN3_VERIFICATION_REPORT.md` — human-readable summary of all V1–V4 results.
- `tests/a11y/axe-sweep.mjs` — a11y harness using `@axe-core/playwright`.
- `tests/a11y/results.json` — axe findings, machine-readable.

**Modified:**
- (none expected — this plan adds verification, doesn't change product code)

---

## Task V1: Full Vitest suite — record green count

**Files:** `tests/visual/PLAN3_VERIFICATION_REPORT.md` (create)

- [ ] **Step 1: Run the full suite**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npm run test:run 2>&1 | tee /tmp/vitest-plan3.log | tail -10
```

Expected: 15/16 files pass (`AuthContext.test.tsx` flake is pre-existing), ≥99 tests green (60 from primitives+layouts + 25 from Tokens + the rest of the existing pre-redesign suite).

- [ ] **Step 2: Record in the report**

Append to `tests/visual/PLAN3_VERIFICATION_REPORT.md`:

```markdown
## V1 — Vitest suite

- Files passed: <N>/<M>
- Tests passed: <N>/<M>
- Flake: AuthContext.test.tsx vitest worker timeout (pre-existing, not a Plan 3 regression)
```

---

## Task V2: Production build size budget

**Files:** `tests/visual/PLAN3_VERIFICATION_REPORT.md` (modify)

- [ ] **Step 1: Build clean**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && rm -rf dist && npm run build 2>&1 | tail -20 > /tmp/build-plan3.log && cat /tmp/build-plan3.log
```

- [ ] **Step 2: Compute total gzipped size of CSS+JS chunks**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && find dist/assets -type f \( -name '*.js' -o -name '*.css' \) -exec wc -c {} + | tail -1 && echo "---gzip total---" && find dist/assets -type f \( -name '*.js' -o -name '*.css' \) -print0 | xargs -0 cat | gzip -9 | wc -c
```

- [ ] **Step 3: Record in report**

Append to `tests/visual/PLAN3_VERIFICATION_REPORT.md`:

```markdown
## V2 — Production build budget

- Total raw bytes (CSS+JS): <N>
- Total gzip-9 bytes: <N>
- Largest chunks: editor (~600 kB gz), vendor-highlight-languages (~280 kB gz), vendor-refractor (~220 kB gz). These are pre-redesign chunks (Monaco editor + syntax highlighting); the redesign did not change them.
- Verdict: <under budget / overage flagged>
```

The redesign's intent is no perf regression — primitives + shells + framer-motion add modest weight, but the deletions in Plan 2 (legacy Layout, Navbar, Sidebar, ~300 lines of bespoke CSS) offset.

---

## Task V3: Accessibility sweep (axe-core)

**Files:**
- Create: `tests/a11y/axe-sweep.mjs`
- Create: `tests/a11y/results.json` (output)
- Modify: `tests/visual/PLAN3_VERIFICATION_REPORT.md`

`@axe-core/playwright` is already installed at the worktree root from Phase A.

- [ ] **Step 1: Write the axe sweep harness**

Create `tests/a11y/axe-sweep.mjs`:

```js
#!/usr/bin/env node
/* eslint-disable no-console */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.SWEEP_BASE_URL ?? 'http://127.0.0.1:4173';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));

// Sweep a tractable subset — the brand-surface routes plus a few
// representative operator routes. Full 36-route sweep is overkill
// for a foundation check.
const ROUTES = [
  { path: '/login',            tag: 'brand'    },
  { path: '/register',         tag: 'brand'    },
  { path: '/auth/callback',    tag: 'brand'    },
  { path: '/pending-approval', tag: 'brand'    },
  { path: '/landing',          tag: 'brand'    },
  { path: '/404',              tag: 'brand'    },
  { path: '/dashboard',        tag: 'operator' },
  { path: '/scripts',          tag: 'operator' },
  { path: '/settings/profile', tag: 'operator' },
];

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const summary = [];
  for (const route of ROUTES) {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(800);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      const violations = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
      }));
      summary.push({ route: route.path, tag: route.tag, violations, total: violations.length });
    } catch (err) {
      summary.push({ route: route.path, tag: route.tag, error: err.message });
    } finally {
      await page.close();
    }
  }
  await browser.close();
  await fs.writeFile(path.join(ROOT, 'results.json'), JSON.stringify(summary, null, 2));
  const total = summary.reduce((sum, s) => sum + (s.total ?? 0), 0);
  console.log(JSON.stringify({ routes: summary.length, totalViolations: total, perRoute: summary.map((s) => ({ route: s.route, count: s.total ?? 'error' })) }, null, 2));
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(2); });
```

- [ ] **Step 2: Build + serve + run**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npm run build 2>&1 | tail -3 && (lsof -ti :4173 | xargs kill 2>/dev/null; nohup npm run preview -- --port 4173 --host 127.0.0.1 > /tmp/preview-v3.log 2>&1 & echo $! > /tmp/preview-v3.pid); sleep 5; cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && SWEEP_BASE_URL=http://127.0.0.1:4173 node tests/a11y/axe-sweep.mjs 2>&1 | tail -30 && kill $(cat /tmp/preview-v3.pid) 2>/dev/null; rm -f /tmp/preview-v3.pid
```

- [ ] **Step 3: Append to report**

```markdown
## V3 — Accessibility (axe-core, WCAG 2.1 AA)

- Routes audited: 9 (6 brand + 3 operator)
- Total violations: <N>
- Per-route breakdown: <copy from JSON>
- Top issues (by impact): <list>
- Verdict: <pass / fix-list filed>
```

If any `critical`/`serious` violations are found, file them as Plan-3 follow-up tasks rather than blocking this commit; visual chrome is the area most likely to surface findings (e.g., color contrast on Aurora gradient, focus-ring visibility on Frosted Graphite). Fixes that are 1-line edits can be folded back into the redesign branch directly.

---

## Task V4: Visual diff sweep (DEFERRED — human-in-loop)

**Files:** `tests/visual/__current__/`, `tests/visual/__diff__/` (created by harness; not committed).

**Why deferred:** the redesign INTENDS to change every route's visuals. Running pixelmatch will produce huge mismatches by design. A human has to triage which diffs are intended (Aurora glow on Login, Frosted Graphite on Dashboard, etc.) vs. regressions (broken layout, missing element, contrast inversion). Auto-running this without that triage step produces noise, not signal.

The harness command is provided here for the human reviewer to run before merge:

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/src/frontend && npm run build && (lsof -ti :4173 | xargs kill 2>/dev/null; nohup npm run preview -- --port 4173 --host 127.0.0.1 > /tmp/preview-v4.log 2>&1 & echo $! > /tmp/preview-v4.pid); sleep 5; cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && SWEEP_BASE_URL=http://127.0.0.1:4173 node tests/visual/route-sweep.mjs --diff 2>&1 | tail -40; kill $(cat /tmp/preview-v4.pid) 2>/dev/null; rm -f /tmp/preview-v4.pid
```

The output JSON includes `totalMismatch` (sum of mismatched pixels across all 136 captures) and a `diffSample` of the first 10. The diffs themselves render in `tests/visual/__diff__/` as red-overlay PNGs.

---

## Task V5: Final code-review pass over the entire branch

**Files:** none — review activity.

The subagent-driven-development skill calls for a final reviewer over the entire implementation after all per-task reviews. Plans 1 and 2 were reviewed at phase boundaries; this is the catch-everything sweep.

```
Dispatch superpowers:code-reviewer subagent with:

WHAT_WAS_IMPLEMENTED: Three-plan frontend modernization on
  redesign/2026-04-28-frontend-modernization (HEAD a few commits ahead
  of 008ba3f after Plan 3 lands its verification commit). Plan 1
  introduced tokens, fonts, primitives, and shells. Plan 2 reflowed
  pages and tore down legacy machinery (Layout/Navbar/Sidebar component
  files, bespoke utility classes, the legacy variable shim). Plan 3
  produced verification artifacts.

PLAN_OR_REQUIREMENTS: docs/superpowers/specs/2026-04-28-frontend-modernization-design.md
  + plans 1, 2, 3.

BASE_SHA: 3975e10  (the plan commit)
HEAD_SHA: <Plan 3 commit>

DESCRIPTION: Cumulative branch review. Look for cross-plan integration
  issues — tokens that aren't actually consumed, primitives that don't
  follow shared conventions, places where Plan 1's foundation and Plan
  2's teardown might disagree.
```

---

## Task V6: Update memory + commit Plan 3 artifacts

- [ ] **Step 1: Stage the verification artifacts**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && git add tests/visual/PLAN3_VERIFICATION_REPORT.md tests/a11y/axe-sweep.mjs tests/a11y/results.json && git status --short
```

- [ ] **Step 2: Commit**

```bash
cd /Users/morlock/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28 && git commit -m "$(cat <<'EOF'
chore(redesign): Plan 3 verification artifacts

V1 Vitest suite, V2 production build budget, V3 axe-core a11y sweep
across the 6 brand routes + 3 representative operator routes.

V4 (full 136-capture pixelmatch visual diff) is intentionally deferred
to the human reviewer because most route diffs will be huge mismatches
by design — auto-running it without triage produces noise, not signal.
The runnable command is recorded in the verification report and in
plan-3-verification.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)" && git log --oneline -3
```

---

## Self-Review

- **Spec coverage:** the design spec's section 11 ("Risk + Verification") calls for a visual diff baseline (V4), an a11y sweep (V3), a perf budget (V2), and full test green (V1). All four are addressed.
- **Honesty:** V4 is deferred deliberately. Auto-running it on a redesign that changes every visual would produce a 100% mismatch rate by definition — meaningless without human triage. The plan acknowledges this rather than papering over it.
- **No placeholders:** every step has the exact command. The harness for V3 is fully written, not a sketch.

---

## Execution

Recommended: superpowers:executing-plans for V1–V3 + V6, then human triage of V4 + V5 outside this session.
