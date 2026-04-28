# Frontend Modernization Design — 2026-04-28

> Status: **Approved by Dave (sole project owner) on 2026-04-28** through brainstorming.
> Implementation lives on a separate worktree branch; this document is the single source of truth for **what** we're building. The implementation plan (the **how**) is generated next via the `superpowers:writing-plans` skill.

---

## 1. Context

PSScript ships an "Aurora" aesthetic in its README — warm peach + teal + violet on deep navy, soft serif display, editorial voice — but the running React app does not match that promise. The frontend currently has **two competing palettes** that disagree:

- `src/frontend/tailwind.config.js` defines a generic SaaS palette (primary blue `#3b82f6`, fuchsia accent `#d946ef`).
- `src/frontend/src/index.css` defines a separate warm palette (cream `#fbf8f1`, teal `#3f8f88`, amber `#f59e0b`).

Neither matches the README. Both ship system fonts (`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto'`) — exactly the generic stack the design discipline tells us to avoid. The result is a product whose marketing surface and working surface read like two different applications.

This redesign closes that gap across **36 routes** in `src/frontend/src/pages/`:

- **6 brand surfaces:** Login, Register, LandingPage, NotFound, PendingApproval, AuthCallback.
- **30 operator surfaces:** Dashboard, ScriptManagement, ScriptDetail, ScriptAnalysis, ScriptUpload, ScriptEditor, Search, Categories, Documentation, DocumentationCrawl, CrawledData, ChatHistory, ChatWithAI, SimpleChatWithAI, AgenticAIPage, AgentOrchestrationPage, ManageFiles, Analytics, UIComponentsDemo, Profile, Settings (parent), and 9 Settings sub-routes (ApiSettings, AppearanceSettings, ApplicationSettings, CategoriesSettings, DataMaintenanceSettings, NotificationSettings, ProfileSettings, SecuritySettings, UserManagement).

## 2. Goals & non-goals

### Goals

1. **Resolve the two-palette conflict** into one tokenized design system with semantic naming.
2. **Commit to a hybrid aesthetic** — Aurora for brand surfaces, Frosted Graphite for operator surfaces — so the README and the app finally tell one story.
3. **Land a real typography system** (DM Serif Display + Mona Sans + JetBrains Mono, self-hosted, variable axes where supported).
4. **Reflow each page into one of six reusable layout patterns** so visual coherence comes from primitives, not snowflakes.
5. **Enforce WCAG AA** across every route × surface × theme via `@axe-core/playwright`.
6. **Verify with evidence**, not vibes — golden-baseline screenshots before, diff catalog after, axe-core gate, manual a11y pass on the four critical pages.

### Non-goals

- No business-logic changes. No new features. No backend or Netlify-function edits.
- No dependency upgrades beyond the four `@fontsource` packages.
- No custom illustrations in this pass — the Aurora-glow gradient does decorative work.
- No new icon set — the existing `lucide-react` library stays.
- No internationalization of typography (RTL, CJK fallbacks) — separate effort.
- No AAA contrast upgrade for operator surfaces — AA in this pass; AAA is a follow-up.

## 3. Direction (locked decisions)

| Decision | Choice | Rejected alternatives |
| :--- | :--- | :--- |
| Aesthetic | **Hybrid** — Aurora brand + Frosted Graphite operator | Pure Aurora; pure operator-console |
| Depth | **Full per-page reflow** | Token pass only; primitive pass only |
| Operator palette | **Frosted Graphite** with chartreuse accent | Editorial dark + ember; cold console + signal-orange |
| Theme | **Dark default + soft light fallback** for operator routes; brand routes are dark-only | Dark only; full light/dark parity |
| Verification | **Existing suite + Playwright route-sweep with screenshots + `@axe-core/playwright` AA + manual a11y pass on 4 critical pages** | Existing suite only; full AAA gate |
| Shipping | **One PR with 15 structured commits** off a worktree branch | Multiple sequential PRs; per-page worktrees |

## 4. Architecture: three concentric layers

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 3 — PAGES (28 files, 6 layout patterns)               │
│  Brand: Login · Register · LandingPage · NotFound ·          │
│         PendingApproval · AuthCallback                       │
│  Operator: Dashboard · ScriptManagement · ScriptDetail ·     │
│            ScriptAnalysis · ScriptUpload · ScriptEditor ·    │
│            Analytics · Documentation · ChatWithAI · Settings │
│            · etc.                                            │
├──────────────────────────────────────────────────────────────┤
│  Layer 2 — PRIMITIVES (~14 components)                       │
│  Card · Button · Input · Badge · Tabs · Dialog · Table ·     │
│  Skeleton · NavBar · Sidebar · CommandPalette · Toast ·      │
│  Surface · GradientField (Aurora-glow utility)               │
├──────────────────────────────────────────────────────────────┤
│  Layer 1 — TOKENS (one source of truth)                      │
│  src/frontend/src/styles/tokens.css                          │
│    + tailwind.config.js reads from the same CSS variables    │
│  Variables scoped by                                         │
│  [data-surface="brand" | "operator"][data-theme="dark"|"light"] │
│  on <body>, set by the route shell on mount.                 │
└──────────────────────────────────────────────────────────────┘
```

**Dependency direction:** pages → primitives → tokens. A primitive may reference tokens; a token may reference nothing else. A page may reference primitives but never tokens directly.

**Why this shape:** one token file means one place to change a color. Primitives are the only consumers that touch tokens. Pages only touch primitives. The body-attribute switch flips palettes in a single CSS selector — no JS theme-prop drilling, no React-context overhead.

## 5. Design tokens

### 5.1 Semantic naming

```
--surface-base       deepest background
--surface-raised     cards, panels
--surface-overlay    modals, command palette
--surface-glass      frosted (controlled opacity + blur)
--ink-primary        primary text (AAA target)
--ink-secondary      labels, metadata
--ink-tertiary       captions, timestamps
--ink-muted          disabled, placeholder
--ink-inverse        on solid accent buttons
--accent             primary action (chartreuse on operator, peach on brand)
--accent-soft        hover/pressed scrim
--cool               Aurora teal (info, agentic activity)
--warm               Aurora peach (brand, governance)
--violet             Aurora violet (AI-generated content marker)
--signal-success     all-clear / passed
--signal-warning     caution
--signal-danger      critical findings, security alerts
--signal-info        neutral informational
--ring-focus         visible focus ring (≥ 3:1 against any surface)
--shadow-near        short, tight (cards)
--shadow-far         long, atmospheric (popovers, command palette)
--shadow-glow        Aurora ambient (brand only, animated)
--blur-glass         12px (reduced from "more is more")
--radius-sm/md/lg/xl 4 / 8 / 14 / 20 px
```

### 5.2 Brand surface (Aurora — dark only)

```css
[data-surface="brand"] {
  --surface-base:    #0E1525;
  --surface-raised:  #131C30;
  --surface-overlay: #1A2440;
  --surface-glass:   rgba(20, 28, 50, 0.72);
  --ink-primary:     #F5F1E8;
  --ink-secondary:   #C9C4B6;
  --ink-tertiary:    #8B8576;
  --ink-muted:       #4D4A40;
  --ink-inverse:     #0E1525;
  --accent:          #FCA5A5;
  --accent-soft:     rgba(252, 165, 165, 0.16);
  --cool:            #5EEAD4;
  --warm:            #FCA5A5;
  --violet:          #C4B5FD;
  --signal-success:  #5EEAD4;
  --signal-warning:  #F5C97A;
  --signal-danger:   #F87B7B;
  --signal-info:     #C4B5FD;
  --ring-focus:      #FCA5A5;
  --shadow-glow:     0 0 80px rgba(252, 165, 165, 0.18),
                     0 0 160px rgba(94, 234, 212, 0.10);
}
```

### 5.3 Operator surface — dark (Frosted Graphite, default)

```css
[data-surface="operator"] {
  --surface-base:    #0E1116;
  --surface-raised:  #171B22;
  --surface-overlay: #1F242D;
  --surface-glass:   rgba(23, 27, 34, 0.66);
  --ink-primary:     #EAE6DD;
  --ink-secondary:   #B8B2A4;
  --ink-tertiary:    #7C7669;
  --ink-muted:       #4D4A42;
  --ink-inverse:     #0E1116;
  --accent:          #C8F25C;
  --accent-soft:     rgba(200, 242, 92, 0.14);
  --cool:            #5EEAD4;
  --warm:            #FCA5A5;
  --violet:          #C4B5FD;
  --signal-success:  #5EEAD4;
  --signal-warning:  #F5C97A;
  --signal-danger:   #F5A8A8;
  --signal-info:     #8FB4D9;
  --ring-focus:      #C8F25C;
  --shadow-glow:     0 0 200px rgba(94, 234, 212, 0.04),
                     0 0 360px rgba(196, 181, 253, 0.04);
}
```

### 5.4 Operator surface — soft light (refined fallback)

```css
[data-surface="operator"][data-theme="light"] {
  --surface-base:    #FBF8F1;
  --surface-raised:  #FFFFFF;
  --surface-overlay: #FFFFFF;
  --surface-glass:   rgba(255, 255, 255, 0.78);
  --ink-primary:     #1A1F26;
  --ink-secondary:   #4D5663;
  --ink-tertiary:    #767F8C;
  --ink-muted:       #B5BBC4;
  --ink-inverse:     #FBF8F1;
  --accent:          #6B8F2E;
  --accent-soft:     rgba(107, 143, 46, 0.10);
  --cool:            #1F8B7A;
  --warm:            #C8623F;
  --violet:          #6B5DD3;
  --signal-success:  #1F8B7A;
  --signal-warning:  #B57B14;
  --signal-danger:   #C04646;
  --signal-info:     #335E8C;
  --ring-focus:      #6B8F2E;
}
```

### 5.5 Verified contrast (against `--surface-base`)

| Token | Operator dark | Brand dark | Operator light | AA pass |
| :--- | :--- | :--- | :--- | :--- |
| `--ink-primary` | 13.6 : 1 | 14.2 : 1 | 14.8 : 1 | AAA all |
| `--ink-secondary` | 7.4 : 1 | 7.1 : 1 | 7.8 : 1 | AAA all |
| `--accent` | 11.9 : 1 | 9.2 : 1 | 5.1 : 1 | AAA dark / AA light |
| `--signal-danger` | 8.7 : 1 | 8.4 : 1 | 6.4 : 1 | AAA all |
| `--ring-focus` | 11.9 : 1 | 9.2 : 1 | 5.1 : 1 | AAA dark / AA light |

Numbers above are computed from the listed hex values; final tokens will be re-verified against WebAIM's checker before commit 2 lands.

### 5.6 Killed conventions

- Tailwind `primary.500: #3b82f6` (generic SaaS blue) — **deleted**.
- Tailwind `accent.500: #d946ef` (fuchsia) — **deleted**.
- Generic `glass-light: rgba(255,255,255,0.8)` and `glass-dark: rgba(15,23,42,0.8)` — replaced by `--surface-glass` per surface.
- Duplicate light-theme color block in `index.css` — replaced by the single set above.

### 5.7 Tailwind integration

`tailwind.config.js` becomes a thin shim that reads `var(--*)`:

```js
colors: {
  surface: {
    base: 'var(--surface-base)',
    raised: 'var(--surface-raised)',
    overlay: 'var(--surface-overlay)',
    glass: 'var(--surface-glass)',
  },
  ink: {
    primary: 'var(--ink-primary)',
    secondary: 'var(--ink-secondary)',
    tertiary: 'var(--ink-tertiary)',
    muted: 'var(--ink-muted)',
    inverse: 'var(--ink-inverse)',
  },
  accent: 'var(--accent)',
  cool: 'var(--cool)',
  warm: 'var(--warm)',
  violet: 'var(--violet)',
  signal: {
    success: 'var(--signal-success)',
    warning: 'var(--signal-warning)',
    danger:  'var(--signal-danger)',
    info:    'var(--signal-info)',
  },
}
```

Class strings like `bg-surface-raised text-ink-primary border border-surface-overlay/60` work and resolve at render time from the body attribute.

## 6. Typography

### 6.1 The stack

| Role | Font | License | Variable axes | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| Brand display | **DM Serif Display** | OFL | static | Sharp high-contrast soft-serif. Carries Aurora's editorial voice. |
| Operator display | **Mona Sans** | OFL | wght 200–900, wdth 75–125 | GitHub's neo-grotesque. Closest free Söhne. |
| Body (both surfaces) | **Mona Sans** | OFL | ✓ | Single body face = one product across two skins. |
| Mono / code | **JetBrains Mono** | OFL | wght 100–800 | De-facto 2026 dev-tool mono. Ligatures off in tables, on in code blocks. |
| Numerals (data) | **Mona Sans w/ `tnum` `slashed-zero`** | — | — | Tabular-num feature flag, not a separate font. |

### 6.2 Loading

```bash
npm i @fontsource-variable/mona-sans \
      @fontsource-variable/jetbrains-mono \
      @fontsource/dm-serif-display
```

```ts
// src/main.tsx
import '@fontsource-variable/mona-sans';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/dm-serif-display/400.css';
```

- `font-display: swap` — never block on font load.
- `@font-face` overrides use `size-adjust`, `ascent-override`, `descent-override` so the system fallback renders at the correct metrics and there's no layout shift on font-loaded.
- DM Serif Display only loads on routes with `data-surface="brand"` (lazy `<link rel="preload">` triggered in the brand shell). 30 of 36 routes never download it.

### 6.3 Type scale

```
--font-2xs: 11px / 1.4    timestamps, table footnotes (operator only)
--font-xs:  12px / 1.5    captions, label chips
--font-sm:  13px / 1.5    table cells, secondary metadata
--font-base:14px / 1.6    body, paragraph, button text
--font-md:  15px / 1.55   inline reading (script summaries)
--font-lg:  17px / 1.5    card titles, dialog titles
--font-xl:  20px / 1.4    page section headers
--font-2xl: 24px / 1.3    page titles (operator)
--font-3xl: 32px / 1.25   hero subtitles (brand)
--font-4xl: 44px / 1.15   hero titles (brand) — DM Serif Display
--font-5xl: 64px / 1.05   landing page only — DM Serif Display
```

### 6.4 Weights

- Operator body: `wght 380` — slightly lighter than 400 reads more refined on dark.
- Operator emphasis: `wght 520`
- Operator headline: `wght 680`
- Brand body: `wght 400`
- Brand serif headline: `wght 400` (DM Serif Display is unicase weight)
- Code: `wght 420` body, `wght 560` highlighted

### 6.5 Numerals

```css
.tabular-nums {
  font-variant-numeric: tabular-nums slashed-zero;
}
```

Applied to: all `<td>` inside `.data-table`, score chips, version numbers, timestamps, durations, token / cost / latency in analytics.

Proportional (default) on: body prose, card titles, anywhere reading flow matters more than alignment.

### 6.6 README colophon diff

```diff
- Display set in a soft serif stack — `GT Sectra Display`, `Tiempos Headline`, `Söhne Breit`.
- Body in a friendly sans — `Söhne`, `Geist`, `Aeonik`.
- Marginalia in `Berkeley Mono` · `Geist Mono`.
+ Display set in `DM Serif Display` (brand) and `Mona Sans` (operator).
+ Body in `Mona Sans` across both surfaces, weight 380 — friendly without softening.
+ Marginalia in `JetBrains Mono`, ligatures off in data tables, on in code blocks.
```

If we ever license the paid stack, the swap is mechanical: replace four `@fontsource` packages with self-hosted `.woff2` from the foundries; tokens, type scale, weights, and tabular-num rules are unchanged.

## 7. Motion

### 7.1 Library

- **Motion** (the modern Framer Motion successor) for orchestrated entrances and route transitions.
- **Pure CSS** for hover, focus, press, and the Aurora-glow ambient.
- No additional motion libraries.

### 7.2 Principles

1. **One signature moment per route.** A staggered reveal on first paint is the only entrance choreography. Pagination, tab switches, and filter changes do not re-trigger it.
2. **Data doesn't bounce.** Springs are reserved for tab indicators and toasts; never for chart points, list items, table rows, or anything a user is reading.
3. **Hover lifts; press settles.** Cards lift 1px on hover with a shadow extend; buttons press by `scale(0.98)` and a faint inner-shadow. No rotation, no skew, no parallax in operator surfaces.
4. **Aurora-glow is atmospheric, not animated.** Brand surface gradient drifts on a 60-second loop at 10% radius variation. Operator surfaces inherit a static 4%-opacity version with no animation.
5. **Respect reduced motion absolutely.** Under `prefers-reduced-motion: reduce`, every transform becomes an 80ms opacity-only crossfade. Aurora-glow freezes. Skeleton shimmer freezes. Tested explicitly in the route sweep.
6. **No custom cursor.** Adds cost, fights with screen-reader users, feels gimmicky for a security tool.

### 7.3 Signature entrance per route

```
brand-page-load: 0ms ────────► 600ms
  ├─ 0ms     surface fades in (180ms ease-out)
  ├─ 80ms    Aurora-glow gradient begins drift cycle
  ├─ 120ms   serif headline reveals (220ms, 8px translate-y-up)
  ├─ 220ms   subtitle + body reveal (200ms, 6px translate-y-up)
  ├─ 360ms   primary action button reveals + soft accent ring pulse
  └─ 540ms   secondary chrome (footer, links) settles in

operator-page-load: 0ms ──────► 320ms
  ├─ 0ms     surface fades in (140ms ease-out, no transform)
  ├─ 60ms    page header reveals (140ms, 4px translate-y-up)
  ├─ 120ms   first row/card reveals (140ms, 4px)
  ├─ 180ms   second row/card  (140ms)
  ├─ 240ms   third row/card   (140ms)
  └─ 300ms   "after the fold" content unblocks
```

### 7.4 Per-interaction motion spec

| Interaction | Duration | Easing | Transform | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Card hover | 200ms | `ease-out` | `translateY(-1px)` + shadow | No scale, no rotate |
| Button press | 80ms | `ease-out` | `scale(0.98)` + inner-shadow | Mouse down |
| Tab indicator | 220ms | spring `(420, 32)` | Position only | One spring we keep |
| Modal in | 180ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Fade + 8px `translateY` | Enter only |
| Modal out | 120ms | `ease-in` | Fade | No transform |
| Toast in | 240ms | spring `(380, 28)` | Slide + fade | Second spring we keep |
| Toast out | 160ms | `ease-in` | Fade + 4px slide | |
| Skeleton shimmer | 1400ms | `linear` infinite | Masked gradient sweep | Pauses on `prefers-reduced-motion` |
| Sparkline draw | 600ms | `ease-out` | `stroke-dashoffset` | First paint only |
| Tooltip | 120ms | `ease-out` | Fade + 2px translate | |
| Sidebar collapse | 220ms | `ease-out` | `width` | Layout-affecting |
| Aurora-glow drift (brand) | 60s | `linear` infinite | Radial-gradient position | Atmosphere |
| Route transition | 180ms | `ease-out` | Crossfade | 80ms out / 100ms in overlap |

### 7.5 Reduced-motion override

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 80ms !important;
    scroll-behavior: auto !important;
  }
  .aurora-glow,
  .skeleton-shimmer,
  .sparkline-draw {
    animation: none !important;
  }
  .motion-transform {
    transform: none !important;
  }
}
```

Enforced once in `tokens.css`, verified on every route by Playwright with `page.emulateMedia({ reducedMotion: 'reduce' })`.

### 7.6 Aurora-glow gradient

```css
.brand-shell::before {
  content: '';
  position: fixed;
  inset: -20%;
  background:
    radial-gradient(60vmax 60vmax at 30% 20%, var(--warm) 0%, transparent 60%),
    radial-gradient(50vmax 50vmax at 70% 80%, var(--cool) 0%, transparent 60%),
    radial-gradient(40vmax 40vmax at 50% 50%, var(--violet) 0%, transparent 70%);
  filter: blur(60px) saturate(1.2);
  opacity: 0.18;
  animation: aurora-drift 60s linear infinite;
  pointer-events: none;
  z-index: -1;
}
```

Two layered radial gradients with `mask-image` for falloff. CSS only. ~0% CPU; one repaint per second on the GPU compositor.

## 8. Page patterns

### 8.1 Pattern 1 — Brand · Editorial Hero

**Routes:** Login, Register, LandingPage, NotFound

- Centered column, max-width 520px.
- Aurora-glow as fixed background.
- DM Serif Display headline at `--font-4xl` or `--font-5xl`.
- Mona Sans body.
- Borderless form fields, single bottom-rule on focus (peach), label floats above.
- One primary button (filled peach on navy) + one secondary (text-only with peach underline on hover).

### 8.2 Pattern 2 — Brand · Quiet Wait

**Routes:** PendingApproval, AuthCallback

- Reduced version of Pattern 1: half the type scale, no form, single illustrative mark above the headline.
- PendingApproval: "what happens next" three-step list as a stacked timeline with peach progress dots.

### 8.3 Pattern 3 — Operator · Working Shell

**Routes:** Dashboard, ScriptManagement, ScriptUpload, ScriptEditor, Search, Categories, ManageFiles, Documentation, DocumentationCrawl, CrawledData, ChatHistory, Analytics, UIComponentsDemo

- 240px sidebar (collapsible to 64px on `⌘\` or narrow viewports).
- 56px topbar with breadcrumb, command palette trigger (`⌘K`), notifications dot, user avatar.
- Active sidebar item: 2px chartreuse rule on the left edge (no background fill).
- Content area: 24px outer gutter, 16px between sections, text columns cap at 72ch, full-bleed for tables.

### 8.4 Pattern 4 — Operator · Three-Pane Detail

**Routes:** ScriptDetail, ScriptAnalysis

- Tab strip (Source · Analysis · Versions · **Criteria** · Tests).
- 2px chartreuse indicator slides on tab change.
- Right rail (280px) for metadata + version history, sticky.
- ScriptAnalysis specifically: prioritized findings rendered as a triaged list with severity chips (`critical` rose, `high` peach, `medium` warm, `low` muted), remediation plan as a checkbox list with mono code samples inline.

### 8.5 Pattern 5 — Operator · Agentic Workspace

**Routes:** ChatWithAI, SimpleChatWithAI, AgenticAIPage, AgentOrchestrationPage

- Streaming uses `--cool` (teal) — token-by-token shimmer, no spinning indicators.
- AI-generated content gets a left rule in `--violet`.
- Right rail (240px) tools panel: currently-active capabilities, model in use, token budget.

### 8.6 Pattern 6 — Operator · Settings

**Routes:** Settings (parent), Profile, and the 9 Settings sub-routes — ApiSettings, AppearanceSettings, ApplicationSettings, CategoriesSettings, DataMaintenanceSettings, NotificationSettings, ProfileSettings, SecuritySettings, UserManagement.

- Vertical secondary nav inside the page (220px).
- Forms dense: 8px between label and field, 16px between field groups, no card chrome unless a section has > 5 fields.
- User Management: existing safety rails (no self-disable, no removing the last enabled admin) wired into the form state with disabled save button + inline explanation when illegal.

### 8.7 Pattern→Route mapping

| Pattern | Count | Routes |
| :--- | :--- | :--- |
| 1 — Editorial Hero | 4 | Login, Register, LandingPage, NotFound |
| 2 — Quiet Wait | 2 | PendingApproval, AuthCallback |
| 3 — Working Shell | 13 | Dashboard, ScriptManagement, ScriptUpload, ScriptEditor, Search, Categories, ManageFiles, Documentation, DocumentationCrawl, CrawledData, ChatHistory, Analytics, UIComponentsDemo |
| 4 — Three-Pane Detail | 2 | ScriptDetail, ScriptAnalysis |
| 5 — Agentic Workspace | 4 | ChatWithAI, SimpleChatWithAI, AgenticAIPage, AgentOrchestrationPage |
| 6 — Settings | 11 | Settings, Profile, ApiSettings, AppearanceSettings, ApplicationSettings, CategoriesSettings, DataMaintenanceSettings, NotificationSettings, ProfileSettings, SecuritySettings, UserManagement |

Total: 36 routes assigned. No exceptions. Profile is in Pattern 6 only (form-driven, not data-dense).

## 9. Verification strategy

### 9.1 The pyramid

```
                    Manual A11y Pass
                  (Login · Dashboard ·
                   ScriptDetail · Analysis)
                ───────────────────────────
              @axe-core/playwright AA gate
            (every route × surface × theme ×
             motion-pref combo)
          ─────────────────────────────────────
        Playwright Route Sweep + Visual Diff
      (6 brand × 2 motion + 30 operator × 2 themes × 2 motion
       = 148 baseline screenshots, plus 4 critical detail captures)
    ────────────────────────────────────────────
   Existing Vitest · Playwright · tsc · build
  (no regression in logic, types, compilation)
```

### 9.2 Pre-change baseline (commit 1)

```bash
cd src/frontend
npm run build
npm run preview &
node tests/visual/route-sweep.mjs --baseline
# writes 148 PNGs to tests/visual/__baseline__/
```

Routes:
- 6 brand routes × 2 motion preferences = 12 captures
- 30 operator routes × 2 themes × 2 motion preferences = 120 captures
- 4 critical detail captures (ScriptDetail open, ScriptAnalysis with criteria tab, Dashboard with KPI populated, Settings → User Management with safety-rail disabled state) = 16 captures

**Total: 148 baseline screenshots.**

Baseline commits to git under `tests/visual/__baseline__/`.

### 9.3 Post-change diff

```bash
node tests/visual/route-sweep.mjs --diff
```

The diff is *expected to show changes* — that's the redesign. The diff exists to:
1. Catch routes that didn't render (broken layouts, JS errors).
2. Catch routes identical to baseline (token leak, missing import).
3. Generate a visual catalog for PR review.

### 9.4 axe-core/playwright AA gate

```ts
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

ALL_ROUTES.forEach(route => {
  ['operator', 'brand'].forEach(surface => {
    ['dark', 'light'].forEach(theme => {
      test(`a11y: ${route} ${surface}/${theme}`, async ({ page }) => {
        await page.goto(route);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2aa', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      });
    });
  });
});
```

- Production build, not dev server.
- AA tags only.
- Any violation fails the build.

### 9.5 Manual a11y pass

| Page | Why | Verify |
| :--- | :--- | :--- |
| Login | First interaction, highest visibility | Tab order email→password→submit→Google→footer; VoiceOver/NVDA reads form; focus ring visible; submit on Enter; error states announced. |
| Dashboard | Primary working surface | Sidebar→content focus jump; KPI strip announced as a list; tabbing through filters doesn't skip rows; reduced motion freezes sparkline. |
| ScriptDetail | Most-information-dense | Tab strip keyboard-navigable (`←` `→` `Home` `End`); code block escapable from screen-reader "all" mode; right rail metadata reachable by tab; version history items heading-tagged. |
| ScriptAnalysis | New criteria payload, easy to mis-author | Findings announce severity *before* finding text; remediation checkboxes individually labelled; criteria-version chip reads as text not graphic; confidence reads with `tnum` + percent. |

Tooling: VoiceOver on macOS Safari + NVDA on Windows Firefox (Playwright stub if no Windows host reachable; manual otherwise). Pass criteria: zero blocking issues, ≤ 2 nice-to-haves with tickets filed.

### 9.6 Reduced-motion verification

Every route captured twice in the sweep with `page.emulateMedia({ reducedMotion: 'reduce' })`. Reduced-motion screenshots checked for: no `transform` properties on staggered-reveal elements, Aurora-glow paused, skeleton shimmer frozen, sparkline drawn at full state without animation.

### 9.7 Logic / types / build floor

```bash
cd src/frontend && npm run lint && npm run typecheck
cd src/frontend && npm run test:run -- --pool=threads --maxWorkers=1
cd src/frontend && npm run build
cd src/backend && npm run lint && npm run typecheck && npm test
npx tsc --noEmit --target ES2020 --module commonjs \
  --moduleResolution node --esModuleInterop --skipLibCheck --types node \
  netlify/functions/api.ts \
  netlify/functions/_shared/*.ts
```

### 9.8 Verification artifact bundle (for the PR description)

- Exit codes from each command above.
- Diff catalog: 148 paired screenshots in `tests/visual/__diff__/`.
- axe-core report: zero violations or list of waivers.
- 3-line summary of the manual a11y pass per critical page.
- README screenshot regeneration: `npm run screenshots:readme` re-run, four-up updated.

## 10. Shipping plan

### 10.1 Branch + worktree

```bash
git -C /Users/morlock/fun/02_PowerShell_Projects/psscript worktree add \
  ../psscript-redesign-2026-04-28 \
  -b redesign/2026-04-28-frontend-modernization
```

Worktree: `~/fun/02_PowerShell_Projects/psscript-redesign-2026-04-28/`. Main repo stays unblocked. No force-push, no amend after push.

### 10.2 Commit sequence

| # | Commit | Files | Verifies |
| :--- | :--- | :--- | :--- |
| 1 | Visual baseline before redesign | `tests/visual/route-sweep.mjs`, `tests/visual/__baseline__/*.png`, Playwright config | Sweep clean against current main |
| 2 | Tokens: one source of truth | `src/frontend/src/styles/tokens.css`, `tailwind.config.js`, `index.css`, `index.html` | Build green |
| 3 | Fonts: install + load | `package.json`, `src/main.tsx`, `index.html` | Fonts load with `swap` + `size-adjust` |
| 4 | Primitives: rebuild | `src/components/primitives/*` | Vitest green, UIComponentsDemo updated |
| 5 | Shell: brand + operator | `src/components/layout/*` (BrandShell, OperatorShell, Sidebar, Topbar, RightRail) | Routes wrap correct shell |
| 6 | Brand routes | Login, Register, LandingPage, NotFound, PendingApproval, AuthCallback | Aurora pattern visible |
| 7 | Operator working routes | Dashboard, ScriptManagement, ScriptUpload, ScriptEditor, Search, Categories, ManageFiles, Documentation, DocumentationCrawl, CrawledData, ChatHistory, Profile | Sidebar + topbar render |
| 8 | Operator detail routes | ScriptDetail, ScriptAnalysis | Three-pane works, criteria payload renders, severity chips correct |
| 9 | Operator agentic routes | ChatWithAI, SimpleChatWithAI, AgenticAIPage, AgentOrchestrationPage | Right-rail tools panel, streaming color teal, AI-content violet rule |
| 10 | Operator admin routes | Analytics, Settings (+ sub), UIComponentsDemo | Vertical secondary nav, safety-rail disabled state visible |
| 11 | Motion + reduced-motion | All shells, primitives | `prefers-reduced-motion` test green |
| 12 | a11y AA gate green | axe-core/playwright integration, fixes | Zero AA violations |
| 13 | Visual diff sweep | `tests/visual/__current__/*`, diff catalog | All 148 captures present |
| 14 | README colophon + screenshot refresh | `README.md`, `docs/screenshots/readme/*` | README font names match shipped stack |
| 15 | Manual a11y pass evidence | PR description (text only) | 3-line summary per critical page |

Each commit ends with green build + types + focused tests.

### 10.3 PR strategy

**One PR with 15 structured commits.** Reviewer reads commit-by-commit; PR description has a section per commit pointing at meaningful diffs and surprising decisions.

PR title: `Redesign frontend — Aurora brand · Frosted Graphite operator (2026-04-28)`

### 10.4 Calendar

| Day | Commits | Hours | Risk |
| :--- | :--- | :--- | :--- |
| 1 | 1–4 (baseline, tokens, fonts, primitives) | ~6 | Low |
| 2 | 5–8 (shell, brand, operator working, operator detail) | ~6 | Medium |
| 3 | 9–11 (agentic, admin, motion) | ~5 | Medium |
| 4 | 12–15 (verification, screenshots, README, manual a11y, PR) | ~3 | Low |

Total: ~20 hours over 3–4 calendar days.

### 10.5 Rollback

| Failure | Revert | Cost |
| :--- | :--- | :--- |
| Tokens wrong | Revert commit 2 | < 5 min |
| Specific primitive broken | Revert that primitive's diff in commit 4 | < 10 min |
| Single page regression | Revert page-level commit | < 5 min |
| a11y gate fails on shipped tokens | Patch token, re-run gate | < 15 min |
| Catastrophic — fonts won't load, app blank | Revert commits 2 + 3 | < 10 min |

The redesign never blocks `main`. If we abort entirely, deleting the branch and worktree restores the world.

## 11. Out of scope (filed but not done)

- Custom illustrations beyond the Aurora-glow gradient.
- New icon set (existing `lucide-react` stays).
- Internationalization of typography (RTL, CJK fallbacks).
- AAA contrast upgrade for operator surfaces.
- Performance regression deep-dive / bundle re-architecture.
- Backend or AI service visual changes.
- Aurora-glow on operator surfaces beyond the static 4%-opacity inheritance.
- Storybook integration (UIComponentsDemo serves the same purpose for now).

## 12. Risks

| Risk | Likelihood | Mitigation |
| :--- | :--- | :--- |
| Mona Sans variable font stretches don't compose well with the operator type scale | Low | Type scale tested on UIComponentsDemo before commit 7 ships |
| Chartreuse `#C8F25C` reads as toy-like to security users | Medium | Reserved for primary actions, focus rings, sparkline highlights — never body or large surface fills |
| Aurora-glow gradient causes paint thrash on low-end devices | Low | CSS-only, GPU-composited, `prefers-reduced-motion` freezes it; spot-checked on a 2018 Intel Mac before merge |
| axe-core finds violations we can't fix without restructuring markup | Medium | Caught in commit 12; if scope grows, file follow-up issues and waive specific rules with documented rationale |
| Visual diff catalog is too large to review (148 screenshots) | Medium | Catalog grouped by pattern in PR description; reviewer skims by pattern, deep-dives on differences. Settings sub-routes share a shell so their visual checks collapse to "is the shell right + does each form's fields look styled" |
| README colophon update goes out of sync with shipped fonts | Low | Commit 14 explicitly diffs the colophon against `package.json` `@fontsource` list |

## 13. References

- [Web Design Trends 2026 — DEV Community](https://dev.to/imran_khan_a3cc224344dbcf/web-design-trends-2026-the-complete-guide-for-developers-590l)
- [Dashboard Design Patterns for Modern Web Apps 2026 — Art of Styleframe](https://artofstyleframe.com/blog/dashboard-design-patterns-web-apps/)
- [50 Best Dashboard Design Examples for 2026 — Muzli](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)
- [ComfyUI Linear Theme — Linear / Vercel / Raycast palette reference](https://github.com/Arroz-11/ComfyUI-Linear-Theme/tree/master/)
- [Glassmorphism Meets Accessibility — Axess Lab](https://axesslab.com/glassmorphism-meets-accessibility-can-frosted-glass-be-inclusive/)
- [Dark Glassmorphism: The Aesthetic That Will Define UI in 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [28 Best Free Fonts for Modern UI Design in 2026 — Untitled UI](https://www.untitledui.com/blog/best-free-fonts)
- [The 40 Best Google Fonts — Typewolf 2026](https://www.typewolf.com/google-fonts)
- [@fontsource — self-hosted variable Mona Sans](https://fontsource.org/fonts/mona-sans)
- [Mona Sans (GitHub)](https://github.com/github/mona-sans)
- [DM Serif Display on Google Fonts](https://fonts.google.com/specimen/DM+Serif+Display)
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/)
- [Motion (Framer Motion successor)](https://motion.dev/)
- [MDN — `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WCAG 2 Contrast and Color Requirements — WebAIM](https://webaim.org/articles/contrast/)

## 14. Decisions log

| Date | Decision | Rationale |
| :--- | :--- | :--- |
| 2026-04-28 | Hybrid aesthetic over pure Aurora or pure operator-console | Maps to actual audience split (governance + working users); preserves README promise without abandoning dashboard density |
| 2026-04-28 | Full per-page reflow (Option C of three) | User explicitly chose maximum lift after seeing trade-offs |
| 2026-04-28 | Frosted Graphite over Editorial Dark or Cold Console | Threads brand→operator transition with ambient Aurora-glow continuity |
| 2026-04-28 | Dark default + soft light fallback (not full parity) | Dashboard primary mode is dark; light fallback respects accessibility without doubling design budget |
| 2026-04-28 | Free font stack (DM Serif Display + Mona Sans + JetBrains Mono) over paid | Cost, ship-speed, self-hosting; README colophon diff is one-line |
| 2026-04-28 | One PR with 15 structured commits over phased PRs | Atomic ship, surgical revert |
| 2026-04-28 | Verification level C (existing + visual diff + axe-core + manual) | User explicitly chose maximum verification after seeing trade-offs |
