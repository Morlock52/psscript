#!/bin/bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT_DIR/logs"

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

"$ROOT_DIR/start-backend-mock.sh" > "$LOG_DIR/readme-backend.log" 2>&1 &
BACKEND_PID=$!

"$ROOT_DIR/start-frontend-mock.sh" > "$LOG_DIR/readme-frontend.log" 2>&1 &
FRONTEND_PID=$!

cleanup() {
  kill "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

wait_for_url() {
  local url="$1"
  local name="$2"
  local retries=30

  for ((i=1; i<=retries; i++)); do
    if curl -fsS "$url" > /dev/null; then
      echo "$name is ready: $url"
      return 0
    fi
    sleep 2
  done

  echo "Timed out waiting for $name at $url" >&2
  return 1
}

wait_for_url "http://localhost:4000/health" "Backend"
wait_for_url "http://localhost:3002" "Frontend"

cd "$ROOT_DIR"

npx playwright test tests/e2e/readme-screenshots.spec.ts --project=chromium
