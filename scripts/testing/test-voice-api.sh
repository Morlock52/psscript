#!/usr/bin/env bash
set -euo pipefail

# Legacy compatibility wrapper.
# Canonical implementation lives in scripts/voice-tests-1-8.mjs.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${VOICE_TEST_BASE_URL:-${VOICE_API_BASE_URL:-https://127.0.0.1:4000}}"
JSON_OUT="${VOICE_TEST_JSON_OUT:-/tmp/voice-tests-1-8-latest.json}"
MD_OUT="${VOICE_TEST_MD_OUT:-docs/VOICE-TESTS-1-8-LATEST.md}"
EXTRA_ARGS=()

if [[ "${VOICE_TEST_INSECURE_TLS:-1}" == "1" ]]; then
  EXTRA_ARGS+=(--insecure-tls)
fi

if [[ -n "${VOICE_TEST_TOKEN:-}" ]]; then
  EXTRA_ARGS+=(--skip-login --token "${VOICE_TEST_TOKEN}")
fi

echo "Running canonical voice tests 1-8 via scripts/voice-tests-1-8.mjs"
node scripts/voice-tests-1-8.mjs \
  --base-url "$BASE_URL" \
  --json-out "$JSON_OUT" \
  --md-out "$MD_OUT" \
  "${EXTRA_ARGS[@]}" \
  "$@"
