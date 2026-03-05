# Docker Setup for PSScript

This document explains how to run the PSScript application using Docker, both for development and production environments.

## Prerequisites

- Docker Engine + Docker Compose v2 (`docker compose`)
- Git (for cloning the repository)

## Install Docker (Recommended: Docker Desktop)

### macOS

1. Install Docker Desktop.
2. Start Docker Desktop (it must be running for `docker` commands to work).
3. Verify:

```bash
docker version
docker info
```

If `docker info` fails with "Cannot connect to the Docker daemon", Docker Desktop is not running yet.

### Windows

1. Install Docker Desktop (WSL2 backend recommended).
2. Start Docker Desktop.
3. Verify in PowerShell:

```powershell
docker version
docker info
```

### Linux

Install Docker Engine + Compose plugin via your distro packages, then verify:

```bash
docker version
docker info
```

## Project Structure

The application consists of several services:

- **Frontend**: React/Vite app on `https://127.0.0.1:3090` (TLS enabled for local mTLS workflows)
- **Backend**: Node.js API on `http://127.0.0.1:4000`
- **AI Service**: Python FastAPI on `http://127.0.0.1:8000`
- **PostgreSQL**: Database with pgvector extension for vector search
- **Redis**: Caching service

## Environment Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/psscript.git
   cd psscript
   ```

2. Create a `.env` file based on the example:

   ```bash
   cp .env.example .env
   ```

3. Edit the `.env` file to set your environment variables, especially:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `JWT_SECRET`: A secure secret for JWT authentication
   - `DB_PASSWORD`: Database password

## Development Environment

To run the application in development mode:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

This will start all services with hot-reloading enabled.

## Production Environment

To run the application in production mode:

```bash
./docker-deploy.sh
```

This script will:

1. Load environment variables from `.env`
2. Build and start all services in production mode
3. Verify that all services are running correctly

Alternatively, you can run:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Accessing the Application

- Frontend: `https://127.0.0.1:3090`
- Backend API: `http://127.0.0.1:4000`
- API Documentation: `http://127.0.0.1:4000/api-docs`

Optional dev tools (enabled by `docker-compose.override.yml`):

- pgAdmin: `http://127.0.0.1:5050`
- Redis Commander: `http://127.0.0.1:8082`

## Troubleshooting

If you encounter any issues:

1. Check the logs:

   ```bash
   # All services
   docker compose logs

   # Specific service
   docker compose logs frontend
   ```

2. Restart services:

   ```bash
   docker compose restart
   ```

3. Rebuild services:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
   ```

### "Cannot connect to the Docker daemon"

This means the Docker daemon isn't running or isn't reachable.

- macOS/Windows: open Docker Desktop and wait until it reports "Docker is running".
- Verify:

```bash
docker info
```

## Notes

- The frontend automatically connects to the backend using the dynamic hostname configuration
- In local dev, the frontend should use same-origin `/api` which Vite proxies to the backend.
- Mock mode can be enabled by setting `MOCK_MODE=true` in the `.env` file

## Stopping the Application

```bash
# Development
docker compose down

# Production
docker compose -f docker-compose.prod.yml down
```

To remove volumes (this will delete all data):

```bash
docker compose down -v
```
