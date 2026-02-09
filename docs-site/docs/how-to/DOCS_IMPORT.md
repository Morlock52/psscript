---
title: Import PowerShell Documentation
description: Import Microsoft Learn (and other sources) into the local documentation database with progress + cancel
---

# Import PowerShell documentation

The Documentation Import screen crawls a source URL, extracts PowerShell-related content, and saves it into the local `documentation` table so you can search it in-app.

## Where to find it

- `https://localhost:3090/documentation/crawl`

Local ports (Feb 2026):

- Frontend: `https://localhost:3090`
- Backend API: `https://localhost:4000`
- AI service: `http://localhost:8000`

## Progress + cancel (AI crawl jobs)

AI-powered imports run as **async jobs** so the browser doesn't time out and show a generic “Network Error”.

While an import is running you will see:

- A progress bar (pages processed vs max pages)
- A “Cancel Import” button

![Documentation import running](/images/screenshots/variants/documentation-import-running-v1.png)

## Tips for fast testing

For quick validation runs:

- Set **Max Pages** to `1`
- Set **Link Depth** to `0`

This keeps the crawl small and makes it easier to verify the end-to-end flow.

