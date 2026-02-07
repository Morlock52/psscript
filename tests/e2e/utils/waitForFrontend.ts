export default async function waitForFrontend(request: any, origin: string): Promise<void> {
  const deadline = Date.now() + 45_000;
  let lastErr: any = null;

  while (Date.now() < deadline) {
    try {
      const resp = await request.get(`${origin}/`, { timeout: 10_000 });
      if (resp && resp.ok()) return;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 700));
  }

  throw new Error(`Frontend not reachable at ${origin} (last error: ${String(lastErr)})`);
}

