#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export SCREENSHOT_LOGIN_URL="${SCREENSHOT_LOGIN_URL:-http://127.0.0.1:3191}"

node scripts/capture-screenshots.js
