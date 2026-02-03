# Claude Code Reference

> **Note:** The main Claude Code guide is at the project root: [../CLAUDE.md](../CLAUDE.md)

This file provides quick reference commands for common development tasks.

## Quick Commands

### Lint Commands

```bash
# Run all linting
npm run lint

# Fix automatically
npm run lint:fix

# Backend only
npm run lint:backend
npm run lint:backend:fix

# Frontend only
npm run lint:frontend
npm run lint:frontend:fix
```

### Type Checking

```bash
cd src/backend && npm run typecheck
```

### Testing

```bash
# Backend tests
cd src/backend && npm test

# Database connectivity
cd src/backend && node test-db.js
cd src/backend && node test-redis.js
```

### Port Management

```bash
./scripts/ensure-ports.sh status
./scripts/ensure-ports.sh kill-frontend
./scripts/ensure-ports.sh kill-backend
```

## Service Ports (Fixed)

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 4000 |
| AI Service | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

For the complete development guide, see [../CLAUDE.md](../CLAUDE.md)
