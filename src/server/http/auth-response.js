import { NextResponse } from 'next/server';
import { getCorsHeaders, hasAllowedOrigin } from '@/server/http/cors';
import { consumeRateLimit } from '@/server/http/rate-limit';

export function authOptions(request) {
  const headers = getCorsHeaders(request);
  return new Response(null, { status: headers ? 204 : 403, headers: headers || {} });
}

export function authJson(request, body, status = 200, extraHeaders = {}) {
  const corsHeaders = getCorsHeaders(request);
  if (request.headers.get('origin') && !corsHeaders) {
    return NextResponse.json({ error: 'This website is not allowed to connect.' }, { status: 403 });
  }
  return NextResponse.json(body, {
    status,
    headers: { ...(corsHeaders || {}), 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export function authRateLimit(request, scope, options) {
  const result = consumeRateLimit(request, scope, options);
  if (result.allowed) return null;
  return authJson(
    request,
    { error: 'Too many attempts. Please try again shortly.' },
    429,
    { 'Retry-After': String(result.retryAfterSeconds) }
  );
}

export function requireTrustedOrigin(request) {
  if (hasAllowedOrigin(request)) return null;
  return authJson(request, { error: 'This action must be started from TaskPilot.' }, 403);
}
