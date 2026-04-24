# PSScript UI Branding Refresh - April 23, 2026

## Summary

The current UI brands PSScript as a PowerShell command center for script intake, AI analysis, governance, and reusable PowerShell knowledge.

## Current Visual System

- Brand mark: terminal prompt, script document, and agent nodes in a single SVG mark.
- Palette: deep PowerShell navy surfaces with cyan, blue, green, and amber accents.
- Shell: grid/radial background, glass sidebar and header, and branded navigation states.
- Dashboard: command-center hero with Upload Script and Ask AI calls to action.
- Script analysis: agentic review header, branded tab rail, and AI-agent analysis panel.
- Loading and PWA surfaces: branded loading screen, SVG favicon, and dark theme color.

## Current Screenshots

The following screenshots were refreshed from the running local app on April 23, 2026:

- `docs/screenshots/dashboard.png`
- `docs/screenshots/dashboard-mobile.png`
- `docs/screenshots/scripts.png`
- `docs/screenshots/upload.png`
- `docs/screenshots/analysis.png`
- `docs/screenshots/settings-categories.png`
- `docs/screenshots/data-maintenance.png`
- `docs/screenshots/analytics.png`
- `docs/screenshots/script-detail.png`
- `docs/screenshots/chat.png`
- `docs/screenshots/documentation.png`
- `docs/screenshots/settings-profile.png`
- `docs/screenshots/settings.png`
- `docs-site/static/images/screenshots/variants/dashboard-v1.png`
- `docs-site/static/images/screenshots/variants/settings-categories-v1.png`

## Implementation Notes

- Reusable brand component: `src/frontend/src/components/BrandMark.tsx`
- Shell and background tokens: `src/frontend/src/index.css`
- Sidebar branding: `src/frontend/src/components/Sidebar.tsx`
- Header branding: `src/frontend/src/components/Navbar.tsx`
- Dashboard hero: `src/frontend/src/pages/Dashboard.tsx`
- Script analysis top-level branding: `src/frontend/src/pages/ScriptAnalysis.tsx`
- Favicon: `src/frontend/public/favicon.svg`
- PWA theme color: `vite-pwa.config.ts`

## Validation

- `./node_modules/.bin/tsc --noEmit --pretty false` passed in `src/frontend`.
- Playwright Chromium smoke rendered dashboard, mobile dashboard, and script analysis with no browser console/page errors.
- The Dashboard button on the script-analysis page navigated to `/dashboard`.
- The Dashboard sidebar link received `aria-current="page"` after navigation.
- Targeted ESLint hung with no output in this workspace and was killed; no lint pass is claimed for this refresh.
