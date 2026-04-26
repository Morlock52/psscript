#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/logs/qa}"
mkdir -p "$OUT_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$OUT_DIR/md-audit-$ts.txt"

{
  echo "== Markdown/Docs Audit =="
  echo "time_utc=$ts"
	  echo

	  echo "-- check ports mentioned"
	  # Keep this focused on "active" docs. Archives/exports are historical and noisy.
	  rg -n 'localhost:3090|localhost:4000|localhost:8000|localhost:4005|localhost:8001' \
	    README.md docs docs-site -S \
	    --glob '!docs/archive/**' \
	    --glob '!docs/exports/**' \
	    --glob '!docs-site/build/**' \
	    --glob '!docs-site/.docusaurus/**' \
	    --glob '!docs-site/node_modules/**' \
	    || true
	  echo

	  echo "-- check old repo name"
	  rg -n 'psscript-manager' README.md docs docs-site src -S \
	    --glob '!docs/archive/**' \
	    --glob '!docs/exports/**' \
	    --glob '!docs-site/build/**' \
	    --glob '!docs-site/.docusaurus/**' \
	    --glob '!docs-site/node_modules/**' \
	    || true
	  echo

  echo "-- non-working links log"
	  if [[ -f docs/non-working-links.md ]]; then
	    wc -l docs/non-working-links.md
	    tail -n 40 docs/non-working-links.md
	  else
	    echo "docs/non-working-links.md missing"
	  fi
	  echo

  echo "OK"
} | tee "$out"
