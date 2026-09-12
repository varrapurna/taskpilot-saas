import { NextResponse } from 'next/server';

const AUTH_COOKIE = 'taskpilot_auth';

export function proxy(request) {
  if (request.cookies.has(AUTH_COOKIE)) return NextResponse.next();

  const loginUrl = new URL('/account/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboard/:path*', '/manage/:path*'],
};
