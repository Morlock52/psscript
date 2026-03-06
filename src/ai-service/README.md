# Legacy AI Service Note

This directory is not the active runtime AI service for the current application.

Current source of truth:
- active AI service code: `src/ai/`
- active AI documentation: [../ai/README.md](../ai/README.md)
- active backend integration target: `http://127.0.0.1:8000`

Why this file still exists:
- older architecture work referenced a separate `src/ai-service` path
- keeping a short note here prevents that older path from being mistaken for the current implementation

If you are setting up the app today, ignore this directory and use `src/ai/`.
