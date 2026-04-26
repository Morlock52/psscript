#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/logs/qa}"
mkdir -p "$OUT_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$OUT_DIR/e2e-$ts.txt"

{
  echo "== E2E (Playwright Chromium) =="
  echo "time_utc=$ts"
  echo
  npx playwright test \
    tests/e2e/health-checks.spec.ts \
    tests/e2e/categories-settings.spec.ts \
    tests/e2e/ai-agents.spec.ts \
    tests/e2e/ai-analytics.spec.ts \
    tests/e2e/script-management.spec.ts \
    --project=chromium --workers=1
  echo
  echo "OK"
} | tee "$out"
