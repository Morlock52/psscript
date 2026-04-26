import json
import sys
import time
import urllib.request
import ssl


def get(url: str, timeout: int = 10) -> dict:
    ctx = ssl._create_unverified_context() if url.startswith("https://") else None
    with urllib.request.urlopen(url, timeout=timeout, context=ctx) as r:
        return json.loads(r.read().decode("utf-8"))


def post_json(url: str, payload: dict, timeout: int = 30, headers: dict | None = None) -> tuple[int, dict]:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        ctx = ssl._create_unverified_context() if url.startswith("https://") else None
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        data = e.read().decode("utf-8")
        try:
            return e.code, json.loads(data)
        except Exception:
            return e.code, {"raw": data}


def main() -> int:
    print("== AI Smoke ==")

    ai = get("http://127.0.0.1:8000/health")
    print("ai_health:", ai.get("status", ai))

    # Prefer backend proxy for chat (HTTPS UI compatibility).
    # With DISABLE_AUTH=true, backend should accept without JWT.
    payload = {"messages": [{"role": "user", "content": "Say hi"}], "agent_type": "assistant"}
    t0 = time.time()
    status, data = post_json("https://127.0.0.1:4000/api/chat", payload, timeout=60)
    dt = time.time() - t0
    print("backend_chat_status:", status, "secs:", round(dt, 2))
    if status != 200 or "response" not in data:
        print("backend_chat_bad_response:", data)
        return 1

    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
