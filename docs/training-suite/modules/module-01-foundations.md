# Module 01: Platform Foundations

## Objectives

- Log in and navigate the main UI
- Understand core services and data flow
- Locate documentation and training resources

## Prerequisites

- Services running on localhost
- Demo credentials available in `docs/LOGIN-CREDENTIALS.md`

## Walkthrough

1. Sign in with the default login button on the login screen.
2. Review the dashboard stats cards and recent scripts.
3. Open the Scripts page and inspect metadata, tags, and scores.
4. Visit Settings and locate the Training Suite link.

## Visual references

![Login Screen](../../screenshots/login.png)

![Dashboard](../../screenshots/dashboard.png)

![Settings](../../screenshots/settings.png)

![Architecture Diagram](../../graphics/architecture.svg)

## Service map

| Service | Role | Default URL |
| --- | --- | --- |
| Frontend | UI for scripts and analytics | http://localhost:3002 |
| Backend API | Auth, scripts, docs | http://localhost:4000/api |
| AI service | Analysis and chat | http://localhost:8000 |

## Key concepts

- Scripts are stored in Postgres with file hash deduplication
- Analysis results are stored as separate records and linked to scripts
- Vector embeddings enable similarity search

## Verification checklist

- You can navigate between Dashboard, Scripts, Analytics, and Settings
- You can open at least one script detail view
- You can locate the Training Suite and Documentation links
