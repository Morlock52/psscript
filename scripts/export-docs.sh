#!/bin/bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

python scripts/export-docs.py "$@"
python scripts/export-docs-docx.py "$@"
node scripts/export-docs.mjs
