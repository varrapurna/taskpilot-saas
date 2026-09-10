import { getCorsHeaders } from '@/lib/cors';

export function authOptions(request) {
  const headers = getCorsHeaders(request);
  return new Response(null, { status: headers ? 204 : 403, headers: headers || {} });
}

export function authJson(request, body, status = 200) {
  const corsHeaders = getCorsHeaders(request);
  if (request.headers.get('origin') && !corsHeaders) {
    return Response.json({ error: 'This website is not allowed to connect.' }, { status: 403 });
  }
  return Response.json(body, {
    status,
    headers: { ...(corsHeaders || {}), 'Cache-Control': 'no-store' },
  });
}
