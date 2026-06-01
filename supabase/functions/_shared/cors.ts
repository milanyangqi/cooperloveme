const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

export function corsHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, stripe-signature, x-client-info");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Vary", "Origin");
  return headers;
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: corsHeaders({
      "Content-Type": "application/json",
      ...init.headers
    })
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, { status });
}

export function options(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
