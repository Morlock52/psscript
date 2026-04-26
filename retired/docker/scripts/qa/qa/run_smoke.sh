#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/logs/qa}"
mkdir -p "$OUT_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$OUT_DIR/smoke-$ts.txt"

wait_http_200() {
  local url="$1"
  local max_secs="${2:-60}"
  local deadline=$(( $(date +%s) + max_secs ))
  while (( $(date +%s) < deadline )); do
    # Curl can legitimately throw transient TLS/connect errors during container startup.
    # Silence stderr here to avoid noisy "connection reset" logs while we retry.
    if curl -skS -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | rg -q "^200$"; then
      return 0
    fi
    sleep 1
  done
  echo "Timeout waiting for 200: $url" >&2
  return 1
}

{
  echo "== Smoke =="
  echo "time_utc=$ts"
  echo

  echo "-- backend health"
  wait_http_200 "https://127.0.0.1:4000/api/health" 90
  curl -skS "https://127.0.0.1:4000/api/health" | python -m json.tool | head -n 60
  echo

  echo "-- ai health"
  wait_http_200 "http://127.0.0.1:8000/health" 60
  curl -sS "http://127.0.0.1:8000/health" | python -m json.tool | head -n 60
  echo

  echo "-- frontend head"
  # Frontend is TLS; just wait for a response.
  local_deadline=$(( $(date +%s) + 60 ))
  while (( $(date +%s) < local_deadline )); do
    if curl -kIs "https://127.0.0.1:3090/" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  curl -kIs "https://127.0.0.1:3090/" | head -n 20
  echo

  echo "-- dashboard endpoints"
  for u in \
    "https://127.0.0.1:4000/api/categories" \
    "https://127.0.0.1:4000/api/scripts?limit=5" \
    "https://127.0.0.1:4000/api/analytics/usage" \
    "https://127.0.0.1:4000/api/analytics/security" \
    "https://127.0.0.1:4000/api/analytics/ai/summary"
  do
    code="$(curl -skS -o /tmp/qa_smoke_body.json -w "%{http_code}" "$u" || true)"
    echo "$u -> $code"
    if [[ "$code" != "200" ]]; then
      echo "FAILED: $u"
      cat /tmp/qa_smoke_body.json || true
      exit 1
    fi
    python -m json.tool </tmp/qa_smoke_body.json >/dev/null
  done
  echo

  echo "OK"
} | tee "$out"
