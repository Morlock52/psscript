# Retired Docker Configuration

Docker is no longer the default deployment path for this project.

Current deployment target:

- Frontend: Netlify project `psscript`
- Database: hosted Supabase Postgres via `DATABASE_URL`
- Backend/AI: external hosted services configured through environment variables

The files in this folder are retained only as historical reference for local
recovery or migration work. Do not use them as the default app runtime.

Original paths were preserved under this archive where practical:

- `root/` contains former root-level Compose and Docker ignore files.
- `src/` contains former service Dockerfiles.
- `.github/workflows/` contains retired Docker CI/publish workflows.
- `docker/` contains former Docker support-service configuration.
