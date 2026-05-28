// Shared CORS headers and wrapper for edge functions.
// Use `serve(withCors(async (req) => { ... }))` to automatically:
//   - respond to OPTIONS preflight with 200 + CORS headers
//   - add CORS headers to every response (including errors) so the browser can read them
//
// All edge functions invoked from the browser MUST use this (or include the same
// headers manually) or Chrome/Safari will block the response.

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

export function optionsResponse(): Response {
  return new Response('ok', { headers: CORS_HEADERS })
}

export function withCors(
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return optionsResponse()

    let response: Response
    try {
      response = await handler(req)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unhandled edge function error'
      response = new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const headers = new Headers(response.headers)
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      headers.set(key, value)
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
