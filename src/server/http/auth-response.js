import { NextResponse } from 'next/server';
import { getCorsHeaders } from '@/server/http/cors';

export function authOptions(request) {
  const headers = getCorsHeaders(request);
  return new Response(null, { status: headers ? 204 : 403, headers: headers || {} });
}

export function authJson(request, body, status = 200) {
  const corsHeaders = getCorsHeaders(request);
  if (request.headers.get('origin') && !corsHeaders) {
    return NextResponse.json({ error: 'This website is not allowed to connect.' }, { status: 403 });
  }
  return NextResponse.json(body, {
    status,
    headers: { ...(corsHeaders || {}), 'Cache-Control': 'no-store' },
  });
}
