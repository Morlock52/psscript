import asyncio
import statistics
import time
from dataclasses import dataclass
import os

import aiohttp


@dataclass
class Result:
    ok: bool
    status: int | None
    ms: float
    url: str
    err: str | None = None


API_BASE = os.environ.get("STRESS_API_BASE", "https://127.0.0.1:4000").rstrip("/")

URLS = [
    f"{API_BASE}/api/health",
    f"{API_BASE}/api/categories",
    f"{API_BASE}/api/scripts?limit=5",
    f"{API_BASE}/api/analytics/usage",
    f"{API_BASE}/api/analytics/security",
    f"{API_BASE}/api/analytics/ai/summary",
    f"{API_BASE}/api/documentation/stats",
]


async def fetch(session: aiohttp.ClientSession, url: str) -> Result:
    t0 = time.perf_counter()
    try:
        async with session.get(url) as r:
            await r.read()
            ms = (time.perf_counter() - t0) * 1000
            ok = 200 <= r.status < 400
            return Result(ok=ok, status=r.status, ms=ms, url=url)
    except Exception as e:
        ms = (time.perf_counter() - t0) * 1000
        return Result(ok=False, status=None, ms=ms, url=url, err=str(e))


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = int(round((p / 100) * (len(values) - 1)))
    return values[k]


async def main(concurrency: int = 40, seconds: int = 180) -> int:
    timeout = aiohttp.ClientTimeout(total=15)
    conn = aiohttp.TCPConnector(ssl=False, limit=concurrency * 3)
    headers = {"Accept-Encoding": "gzip, deflate"}

    end_at = time.time() + seconds
    results: list[Result] = []

    async with aiohttp.ClientSession(timeout=timeout, connector=conn, headers=headers) as session:
        sem = asyncio.Semaphore(concurrency)

        async def one(url: str):
            async with sem:
                results.append(await fetch(session, url))

        while time.time() < end_at:
            tasks = [asyncio.create_task(one(u)) for u in URLS]
            await asyncio.gather(*tasks)

    oks = [r for r in results if r.ok]
    fails = [r for r in results if not r.ok]
    lat = [r.ms for r in results]

    print("== Stress ==")
    print("requests:", len(results), "ok:", len(oks), "fail:", len(fails))
    print("lat_ms: p50=", round(pct(lat, 50), 2), "p95=", round(pct(lat, 95), 2), "p99=", round(pct(lat, 99), 2))

    if fails:
        by = {}
        for f in fails:
            key = f"{f.url} -> {f.status or f.err}"
            by[key] = by.get(key, 0) + 1
        top = sorted(by.items(), key=lambda kv: kv[1], reverse=True)[:10]
        print("top_failures:")
        for k, n in top:
            print(" ", n, k)
        return 1

    return 0


if __name__ == "__main__":
    concurrency = int(os.environ.get("STRESS_CONCURRENCY", "40"))
    seconds = int(os.environ.get("STRESS_SECONDS", "180"))
    raise SystemExit(asyncio.run(main(concurrency=concurrency, seconds=seconds)))
