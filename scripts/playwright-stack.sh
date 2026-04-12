#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/output/playwright"
MODE="${PLAYWRIGHT_STACK_MODE:-auto}"
SERVICES=(postgres redis ai-service backend frontend)

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

PIDS=()
DOCKER_STARTED=false

log() {
  printf '[playwright-stack] %s\n' "$*"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

port_open() {
  nc -z 127.0.0.1 "$1" >/dev/null 2>&1
}

wait_for_port() {
  local port="$1"
  local label="$2"
  local attempts="${3:-60}"
  local i

  for ((i = 0; i < attempts; i += 1)); do
    if port_open "$port"; then
      return 0
    fi
    sleep 1
  done

  log "$label did not start listening on port $port"
  return 1
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  local i

  for ((i = 0; i < attempts; i += 1)); do
    if curl -skf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  log "$label did not become healthy at $url"
  return 1
}

docker_available() {
  command_exists docker &&
    docker compose version >/dev/null 2>&1 &&
    docker info >/dev/null 2>&1
}

start_brew_service_if_needed() {
  local service_name="$1"
  local label="$2"

  if brew services list | awk 'NR > 1 { print $1 " " $2 }' | grep -q "^${service_name} started$"; then
    return 0
  fi

  log "starting $label via brew services"
  brew services start "$service_name" >/dev/null
}

ensure_local_postgres() {
  if command_exists pg_isready && pg_isready -h 127.0.0.1 -p 5432 -d psscript -U postgres >/dev/null 2>&1; then
    return 0
  fi

  if command_exists brew; then
    if brew services list | awk 'NR > 1 { print $1 }' | grep -qx 'postgresql@16'; then
      start_brew_service_if_needed "postgresql@16" "PostgreSQL"
    elif brew services list | awk 'NR > 1 { print $1 }' | grep -qx 'postgresql'; then
      start_brew_service_if_needed "postgresql" "PostgreSQL"
    fi
  fi

  if command_exists pg_isready && pg_isready -h 127.0.0.1 -p 5432 -d psscript -U postgres >/dev/null 2>&1; then
    return 0
  fi

  log "local PostgreSQL is required for PLAYWRIGHT_STACK_MODE=local"
  return 1
}

ensure_local_redis() {
  if command_exists redis-cli && redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
    return 0
  fi

  if command_exists brew && brew services list | awk 'NR > 1 { print $1 }' | grep -qx 'redis'; then
    start_brew_service_if_needed "redis" "Redis"
  fi

  if command_exists redis-cli && redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
    return 0
  fi

  log "local Redis is required for PLAYWRIGHT_STACK_MODE=local"
  return 1
}

require_local_prereq() {
  local cmd="$1"
  local description="$2"

  if ! command_exists "$cmd"; then
    log "$description is required for PLAYWRIGHT_STACK_MODE=local"
    exit 1
  fi
}

start_local_service() {
  local label="$1"
  local workdir="$2"
  local logfile="$3"
  shift 3

  log "starting $label locally"
  (
    cd "$workdir"
    "$@" >"$logfile" 2>&1
  ) &
  PIDS+=("$!")
}

cleanup() {
  local pid

  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done

  if [[ "$DOCKER_STARTED" == true ]]; then
    docker compose stop "${SERVICES[@]}" >/dev/null 2>&1 || true
  fi
}

start_docker_stack() {
  if ! docker_available; then
    log "docker mode requested but Docker Engine is not available"
    exit 1
  fi

  DOCKER_STARTED=true
  exec docker compose up --build "${SERVICES[@]}"
}

start_local_stack() {
  require_local_prereq python "python"
  require_local_prereq npm "npm"
  require_local_prereq curl "curl"
  ensure_local_postgres
  ensure_local_redis

  local ai_log="$LOG_DIR/ai-service.log"
  local backend_log="$LOG_DIR/backend.log"
  local frontend_log="$LOG_DIR/frontend.log"

  if ! port_open 8000; then
    start_local_service \
      "AI service" \
      "$ROOT_DIR/src/ai" \
      "$ai_log" \
      env \
      OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
      ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
      DB_HOST=127.0.0.1 \
      DB_PORT=5432 \
      DB_NAME=psscript \
      DB_USER=postgres \
      DB_PASSWORD=postgres \
      REDIS_URL=redis://127.0.0.1:6379 \
      python -m uvicorn main:app --host 0.0.0.0 --port 8000
  fi

  wait_for_http "http://127.0.0.1:8000/health" "AI service"

  if ! port_open 4000; then
    start_local_service \
      "backend" \
      "$ROOT_DIR/src/backend" \
      "$backend_log" \
      env \
      NODE_ENV=development \
      PORT=4000 \
      DISABLE_AUTH=true \
      RELAX_RATE_LIMITS=true \
      RATE_LIMIT_MULTIPLIER=20 \
      DB_HOST=127.0.0.1 \
      DB_PORT=5432 \
      DB_NAME=psscript \
      DB_USER=postgres \
      DB_PASSWORD=postgres \
      REDIS_URL=redis://127.0.0.1:6379 \
      AI_SERVICE_URL=http://127.0.0.1:8000 \
      JWT_SECRET=development_jwt_secret_key_change_in_production \
      TLS_CERT="$ROOT_DIR/certs/backend.crt" \
      TLS_KEY="$ROOT_DIR/certs/backend.key" \
      npm run dev
  fi

  wait_for_http "https://127.0.0.1:4000/api/health" "backend"

  if ! port_open 3090; then
    start_local_service \
      "frontend" \
      "$ROOT_DIR/src/frontend" \
      "$frontend_log" \
      env \
      NODE_ENV=development \
      VITE_DISABLE_AUTH=true \
      VITE_USE_MOCKS=true \
      VITE_PORT=3090 \
      TLS_CERT="$ROOT_DIR/certs/frontend.crt" \
      TLS_KEY="$ROOT_DIR/certs/frontend.key" \
      npm run dev -- --host 0.0.0.0 --port 3090
  fi

  wait_for_http "https://127.0.0.1:3090" "frontend"

  log "local stack is ready"
  if ((${#PIDS[@]} == 0)); then
    log "all required local services were already running"
    while true; do
      sleep 3600
    done
  fi

  wait "${PIDS[@]}"
}

trap cleanup EXIT INT TERM

case "$MODE" in
  docker)
    start_docker_stack
    ;;
  local)
    start_local_stack
    ;;
  auto)
    if docker_available; then
      start_docker_stack
    else
      log "Docker is unavailable; falling back to local services"
      start_local_stack
    fi
    ;;
  *)
    log "unsupported PLAYWRIGHT_STACK_MODE: $MODE"
    exit 1
    ;;
esac
