#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/logs/qa}"
mkdir -p "$OUT_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$OUT_DIR/db-checks-$ts.txt"

{
  echo "== DB Checks =="
  echo "time_utc=$ts"
  echo

  echo "-- tables"
  docker compose exec -T postgres psql -U postgres -d psscript -c "\\dt"
  echo

  echo "-- key schemas"
  for t in users scripts categories documentation ai_metrics script_analysis; do
    echo "## \\d+ $t"
    docker compose exec -T postgres psql -U postgres -d psscript -c "\\d+ $t" | sed -n '1,120p'
    echo
  done

  echo "-- integrity: orphan categories"
  docker compose exec -T postgres psql -U postgres -d psscript -c \
    "SELECT COUNT(*) AS scripts_with_missing_category FROM scripts s LEFT JOIN categories c ON c.id = s.category_id WHERE s.category_id IS NOT NULL AND c.id IS NULL;"
  echo

  echo "-- integrity: orphan analysis"
  docker compose exec -T postgres psql -U postgres -d psscript -c \
    "SELECT COUNT(*) AS analysis_with_missing_script FROM script_analysis a LEFT JOIN scripts s ON s.id = a.script_id WHERE s.id IS NULL;"
  echo

  echo "-- seed/demo user check"
  docker compose exec -T postgres psql -U postgres -d psscript -c \
    "SELECT id, username, email, role FROM users WHERE email IN ('admin@example.com') ORDER BY id;"
  echo

  echo "OK"
} | tee "$out"
