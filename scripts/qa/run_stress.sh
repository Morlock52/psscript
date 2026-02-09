#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Defaults tuned to be useful but not melt a dev laptop.
CONCURRENCY="${STRESS_CONCURRENCY:-40}"
SECONDS="${STRESS_SECONDS:-180}"

echo "== Stress (API) =="
echo "concurrency=$CONCURRENCY seconds=$SECONDS"

# Run inside the existing backend container to avoid starting extra containers.
# This is more stable on macOS Docker Desktop and avoids external deps like aiohttp.
#
# Note: the backend runs on HTTPS in local dev; we disable TLS verification for load testing.
docker compose exec -T backend env \
  "STRESS_API_BASE=${STRESS_API_BASE:-https://127.0.0.1:4000}" \
  "STRESS_CONCURRENCY=$CONCURRENCY" \
  "STRESS_SECONDS=$SECONDS" \
  node -e '
const https = require("https");

const base = process.env.STRESS_API_BASE || "https://127.0.0.1:4000";
const concurrency = parseInt(process.env.STRESS_CONCURRENCY || "40", 10);
const seconds = parseInt(process.env.STRESS_SECONDS || "180", 10);
const paths = [
  "/api/health",
  "/api/categories",
  "/api/scripts?limit=5",
  "/api/analytics/usage",
  "/api/analytics/security",
  "/api/analytics/ai/summary",
];

const end = Date.now() + seconds * 1000;
let ok = 0;
let fail = 0;

function once(path) {
  return new Promise((resolve) => {
    const req = https.request(base + path, { rejectUnauthorized: false, timeout: 5000 }, (res) => {
      res.resume();
      res.on("end", () => {
        if (res.statusCode === 200) ok++;
        else fail++;
        resolve();
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => {
      fail++;
      resolve();
    });
    req.end();
  });
}

async function worker(i) {
  let idx = i;
  while (Date.now() < end) {
    await once(paths[idx % paths.length]);
    idx++;
  }
}

(async () => {
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  console.log(JSON.stringify({ base, seconds, concurrency, ok, fail }));
  process.exit(fail ? 1 : 0);
})().catch((err) => {
  console.error("stress_failed", err?.message || String(err));
  process.exit(1);
});
'
