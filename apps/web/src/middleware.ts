import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOGIN_PATH = '/login';
const SESSION_COOKIE = 'syn_session';

function getApiBaseUrls(): string[] {
  const configuredUrls = [
    process.env.API_BASE_URL,
    process.env.INTERNAL_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
    'http://api:3001'
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(configuredUrls));
}

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

  let lastNetworkError: unknown = null;

  for (const baseUrl of getApiBaseUrls()) {
    try {
      const response = await fetch(`${baseUrl}/auth/session`, {
        method: 'GET',
        headers: {
          cookie: cookieHeader,
          accept: 'application/json'
        },
        cache: 'no-store'
      });

      return response.ok;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown network error';
      lastNetworkError = new Error(`Failed to reach admin session endpoint at ${baseUrl}: ${message}`);
    }
  }

  if (lastNetworkError) {
    console.error('Failed to validate admin session', lastNetworkError);
  }

  return false;
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
