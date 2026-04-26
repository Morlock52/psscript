#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/logs/qa}"
mkdir -p "$OUT_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="$OUT_DIR/run-$ts"
mkdir -p "$run_dir"

{
  echo "time_utc=$ts"
  echo "git_sha=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo
  docker compose ps
} >"$run_dir/run-info.txt"

if [[ "${QA_BUILD:-0}" == "1" ]]; then
  docker compose --env-file .env up -d --build
else
  docker compose --env-file .env up -d
fi
docker compose config >"$run_dir/compose.rendered.yml"

"$ROOT_DIR/scripts/qa/run_smoke.sh" "$run_dir"
"$ROOT_DIR/scripts/qa/run_db_checks.sh" "$run_dir"
python "$ROOT_DIR/scripts/qa/ai_smoke.py" | tee "$run_dir/ai-smoke-$ts.txt"
"$ROOT_DIR/scripts/qa/run_e2e.sh" "$run_dir"
python "$ROOT_DIR/scripts/qa/stress_api.py" | tee "$run_dir/stress-$ts.txt"
"$ROOT_DIR/scripts/qa/log_audit.sh" "$run_dir"
"$ROOT_DIR/scripts/qa/md_audit.sh" "$run_dir"

echo "ALL_OK (run dir: $run_dir)"
