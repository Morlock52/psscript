#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/logs/qa}"
mkdir -p "$OUT_DIR"

echo "== Full Verification Run 1 =="
"$ROOT_DIR/scripts/qa/run_all.sh" "$OUT_DIR"

echo
echo "== Clean Restart =="
docker compose down
docker compose --env-file .env up -d --build
echo "Restart complete. Next run will wait on health checks."

echo
echo "== Full Verification Run 2 =="
"$ROOT_DIR/scripts/qa/run_all.sh" "$OUT_DIR"
