import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOGIN_PATH = '/login';
const SESSION_COOKIE = 'syn_session';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE);

  if (!sessionCookie && !pathname.startsWith(LOGIN_PATH)) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', `${pathname}${search}`);
    }

    return NextResponse.redirect(loginUrl);
  }

  if (sessionCookie && pathname.startsWith(LOGIN_PATH)) {
    const dashboardUrl = new URL('/', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|api).*)']
};
