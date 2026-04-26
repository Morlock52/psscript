#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/logs/qa}"
mkdir -p "$OUT_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$OUT_DIR/log-audit-$ts.txt"

{
  echo "== Log Audit =="
  echo "time_utc=$ts"
  echo

  echo "-- backend (tail 250)"
  docker compose logs --tail=250 backend | sed -n '1,250p'
  echo

  echo "-- ai-service (tail 250)"
  docker compose logs --tail=250 ai-service | sed -n '1,250p'
  echo

  echo "-- frontend (tail 250)"
  docker compose logs --tail=250 frontend | sed -n '1,250p'
  echo

	  echo "-- suspicious patterns"
	  docker compose logs --tail=2000 backend ai-service frontend | rg -n '\\b(uncaughtException|Unhandled promise rejection|Sequelize.*error|foreign key|ECONN|ECONNRESET|EPIPE|Network Error|502|503|504)\\b' -S || true
	  echo

  echo "OK"
} | tee "$out"
