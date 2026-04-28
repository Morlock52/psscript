# Frontend Modernization — Plan 4 (JSX Var Migration + Shim Trim)

> **For agentic workers:** This plan was executed inline by the controller in a single sed pass + targeted edits, without a subagent dispatch. Documented retroactively per V5 final review request.

**Goal:** Migrate the ~800 JSX call sites that consume legacy `var(--color-*)/var(--shadow-*)/var(--glass-bg)` aliases via Tailwind arbitrary-value classes onto canonical `--surface-*/--ink-*/--accent/--signal-*` names directly, then trim the legacy compatibility shim block in `tokens.css` to only the genuinely derived/composite values that remain.

**Architecture:** Plan 1 introduced the canonical token surface. Plan 2 retired the bespoke utility classes in `index.css`, but its audit grep (`\.classname` patterns) missed the `bg-[var(--color-primary)]` arbitrary-value Tailwind pattern; Plan 3 restored the shim after the gap was caught by the axe a11y sweep. Plan 4 is the actual migration that should have happened in Plan 2: a sed pass over all `.tsx`/`.ts`/`.css` files under `src/frontend/src` that retargets each legacy alias to its canonical equivalent, leaving the shim with only the derived tokens that still benefit from being named.

**Tech Stack:** BSD sed (macOS), git, Vitest. No new dependencies.

---

## Discovery (audit at start of Plan 4, against `b517950`-baseline)

Per-token consumer counts via `grep -rEo 'var\\(<token>\\)' --include='*.tsx' --include='*.ts' --include='*.css' src/frontend/src`:

| Token | Count | Migration target |
|-------|------:|------------------|
| --color-text-primary | 136 | --ink-primary |
| --color-text-secondary | 116 | --ink-secondary |
| --color-text-tertiary | 113 | --ink-tertiary |
| --color-primary | 106 | --accent |
| --color-border-default | 103 | --surface-overlay |
| --color-bg-tertiary | 84 | --surface-overlay |
| --color-bg-primary | 47 | --surface-base |
| --color-bg-elevated | 44 | --surface-raised |
| --color-primary-dark | 21 | **stays** (color-mix derived) |
| --color-primary-light | 12 | --accent-soft |
| --shadow-md | 10 | --shadow-near |
| --shadow-xl | 6 | --shadow-far |
| --color-border-strong | 6 | --ink-muted |
| --color-accent | 5 | --accent |
| --gradient-surface | 5 | **stays** (composite) |
| --shadow-sm | 5 | --shadow-near |
| --shadow-lg | 4 | --shadow-far |
| --gradient-primary | 3 | **stays** (composite) |
| --color-success | 3 | --signal-success |
| --color-bg-secondary | 2 | --surface-raised |
| --color-border-focus | 2 | --ring-focus |
| --color-accent-light | 2 | --accent-soft |
| --color-success-light | 2 | **stays** (color-mix) |
| --color-bg-sunken | 1 | --surface-base |
| --color-warning | 1 | --signal-warning |
| --color-warning-light | 1 | **stays** (color-mix) |
| --color-error | 1 | --signal-danger |
| --color-info | 1 | --signal-info |
| --color-info-light | 1 | **stays** (color-mix) |

Total simple-alias consumers migrated: ~793. Total stays-as-shim: 33 (across 6 distinct tokens).

---

## Migration Mapping (the sed script)

The sed pass was a single chained invocation over all `.tsx`/`.ts`/`.css` files. Order matters: more-specific patterns (`*-light`, `*-dark`, `*-hover`) appear before their prefixes. The actual command run:

```bash
find src/frontend/src \( -name '*.tsx' -o -name '*.ts' -o -name '*.css' \) -type f -print0 | xargs -0 sed -i '' \
  -e 's/var(--color-bg-primary)/var(--surface-base)/g' \
  -e 's/var(--color-bg-secondary)/var(--surface-raised)/g' \
  -e 's/var(--color-bg-tertiary)/var(--surface-overlay)/g' \
  -e 's/var(--color-bg-elevated)/var(--surface-raised)/g' \
  -e 's/var(--color-bg-sunken)/var(--surface-base)/g' \
  -e 's/var(--color-text-primary)/var(--ink-primary)/g' \
  -e 's/var(--color-text-secondary)/var(--ink-secondary)/g' \
  -e 's/var(--color-text-tertiary)/var(--ink-tertiary)/g' \
  -e 's/var(--color-text-muted)/var(--ink-muted)/g' \
  -e 's/var(--color-text-inverse)/var(--ink-inverse)/g' \
  -e 's/var(--color-border-default)/var(--surface-overlay)/g' \
  -e 's/var(--color-border-subtle)/var(--surface-raised)/g' \
  -e 's/var(--color-border-strong)/var(--ink-muted)/g' \
  -e 's/var(--color-border-focus)/var(--ring-focus)/g' \
  -e 's/var(--color-primary-light)/var(--accent-soft)/g' \
  -e 's/var(--color-primary)/var(--accent)/g' \
  -e 's/var(--color-accent-light)/var(--accent-soft)/g' \
  -e 's/var(--color-accent)/var(--accent)/g' \
  -e 's/var(--color-success)/var(--signal-success)/g' \
  -e 's/var(--color-warning)/var(--signal-warning)/g' \
  -e 's/var(--color-error)/var(--signal-danger)/g' \
  -e 's/var(--color-info)/var(--signal-info)/g' \
  -e 's/var(--color-disabled-bg)/var(--surface-overlay)/g' \
  -e 's/var(--color-disabled-text)/var(--ink-muted)/g' \
  -e 's/var(--shadow-xs)/var(--shadow-near)/g' \
  -e 's/var(--shadow-sm)/var(--shadow-near)/g' \
  -e 's/var(--shadow-md)/var(--shadow-near)/g' \
  -e 's/var(--shadow-lg)/var(--shadow-far)/g' \
  -e 's/var(--shadow-xl)/var(--shadow-far)/g' \
  -e 's/var(--glass-bg)/var(--surface-glass)/g'
```

`--color-primary-light` is replaced **before** `--color-primary` because the latter is a prefix of the former (sed's longest-match preference doesn't apply to fixed-string substitution; explicit ordering is required). Same for `--color-accent-light` before `--color-accent`.

---

## What stayed in the shim (and why)

After the sed pass, only these 6 tokens have remaining consumers and are kept in `:root` of `tokens.css`:

| Token | Why it stays |
|-------|--------------|
| `--color-primary-dark` | `color-mix(in srgb, var(--accent) 80%, black)` — derived darker variant. Inlining `color-mix(...)` at 21 call sites is uglier than naming it. |
| `--color-success-light` | `color-mix(in srgb, var(--signal-success) 16%, transparent)` — soft success tint. Derived. |
| `--color-warning-light` | `color-mix(in srgb, var(--signal-warning) 16%, transparent)` — soft warning tint. |
| `--color-info-light` | `color-mix(in srgb, var(--signal-info) 16%, transparent)` — soft info tint. |
| `--gradient-primary` | `linear-gradient(135deg, var(--cool) 0%, var(--violet) 56%, var(--warm) 100%)` — composite. Multi-stop gradient is awkward to inline. |
| `--gradient-surface` | `linear-gradient(180deg, var(--surface-raised) 0%, var(--surface-base) 100%)` — composite. |

Total shim block: 11 lines (down from ~95 pre-Plan-4).

---

## Migration test

`Tokens.test.tsx` extended with a `post-Plan-4 token surface` describe block (28 cases total):

- For each "still defined" token, assert the literal `<name>:` appears in the source text of `tokens.css` (using `fs.readFileSync` + `toContain`). Source-text matching is used because jsdom's CSS parser drops `color-mix()` declarations — `getComputedStyle(documentElement).getPropertyValue` returns empty for them.
- For each "should be removed" token (`--color-bg-primary`, `--color-text-primary`, etc.), assert the same `<name>:` literal does NOT appear.

This is the trip-wire that catches both directions: a future "let's promote this back into the shim" and a future "let's delete the last 6 derived tokens" are each one assertion away from being seen.

---

## Verification

- `npm run test:run -- src/components/primitives/__tests__/Tokens.test.tsx` → 28/28
- `npm run test:run -- src/components/primitives/__tests__/ src/components/layouts/__tests__/` → 63/63
- `npm run build` → clean
- `npx tsc --noEmit` → clean
- Post-migration grep for the 25 deleted aliases → 0 hits each

---

## Why no subagent dispatch

The work was a single sed pass + 1 file rewrite (the trimmed shim) + 1 test file edit. Mechanical, fully audit-reproducible, no design judgment. Subagent ceremony (implementer + spec reviewer + quality reviewer) would have had less ROI than running it directly; the audit-driven nature of the migration is its own correctness check.

---

## Outcome

| Metric | Before | After | Δ |
|--------|--------|-------|---|
| `tokens.css` lines | ~254 | ~80 | −174 |
| Shim `:root` block | ~95 lines | 11 lines | −84 |
| JSX call sites referencing legacy aliases | ~793 | 0 | −793 |
| JSX call sites referencing canonical tokens | (some) | (most) | +~793 |
| Token tests | 25 | 28 | +3 |

Plan 4 commits:
- `da9f43f` — sed migration + shim trim + test surface flip
- `b517950` — merge to main
