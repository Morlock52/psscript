export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function methodNotAllowed(): Response {
  return json({ success: false, error: 'method_not_allowed', message: 'Method not allowed' }, { status: 405 });
}

export function notFound(path: string): Response {
  return json({ success: false, error: 'not_found', message: `No hosted API route for ${path}` }, { status: 404 });
}
