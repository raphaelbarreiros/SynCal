import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOGIN_PATH = '/login';
const SESSION_COOKIE = 'syn_session';
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? 'http://localhost:3001';

function shouldBypassAuth(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  );
}

function buildLoginRedirect(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const loginUrl = new URL(LOGIN_PATH, request.url);

  if (pathname !== '/') {
    loginUrl.searchParams.set('from', `${pathname}${search}`);
  }

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete({ name: SESSION_COOKIE, path: '/' });
  return response;
}

function continueRequestClearingSession(): NextResponse {
  const response = NextResponse.next();
  response.cookies.delete({ name: SESSION_COOKIE, path: '/' });
  return response;
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/session`, {
      method: 'GET',
      headers: {
        cookie: cookieHeader,
        accept: 'application/json'
      },
      cache: 'no-store'
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to validate admin session', error);
    return false;
  }
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldBypassAuth(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const isLoginPath = pathname.startsWith(LOGIN_PATH);

  if (!sessionCookie) {
    return isLoginPath ? NextResponse.next() : buildLoginRedirect(request);
  }

  const sessionValid = await hasValidSession(request);

  if (!sessionValid) {
    return isLoginPath ? continueRequestClearingSession() : buildLoginRedirect(request);
  }

  if (isLoginPath) {
    const dashboardUrl = new URL('/', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}
