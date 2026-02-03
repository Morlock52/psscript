# Docusaurus deployment (GitHub Pages)

This site is configured to deploy to GitHub Pages for `Morlock52/psscript`.

## Prerequisites

- Node.js 18+ installed.
- Access to the `Morlock52/psscript` repository.

## Install dependencies

```bash
cd docs-site
npm install
```

## Build and preview

```bash
npm run build
npm run serve
```

## Deploy

```bash
GIT_USER=Morlock52 npm run deploy
```

If you deploy from CI, set `GIT_USER` and `USE_SSH=true` or `GITHUB_TOKEN` per your workflow.
