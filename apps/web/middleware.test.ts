import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import middleware from './src/middleware';

const SESSION_COOKIE = 'syn_session';

describe('web middleware auth gate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to the login page when no session cookie is present', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const request = new NextRequest('http://localhost/dashboard');

    const response = await middleware(request);
    const locationHeader = response?.headers.get('location');
    const redirectUrl = locationHeader ? new URL(locationHeader) : null;

    expect(redirectUrl?.pathname).toBe('/login');
    expect(redirectUrl?.searchParams.get('from')).toBe('/dashboard');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('redirects to login when the session cookie fails validation', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    const request = new NextRequest('http://localhost/settings', {
      headers: new Headers({ cookie: `${SESSION_COOKIE}=forged` })
    });

    const response = await middleware(request);
    const locationHeader = response?.headers.get('location');
    const redirectUrl = locationHeader ? new URL(locationHeader) : null;

    expect(redirectUrl?.pathname).toBe('/login');
    expect(redirectUrl?.searchParams.get('from')).toBe('/settings');
    expect(response?.headers.get('set-cookie')).toMatch(/syn_session=;/);
  });

  it('allows the request to continue when the session is valid', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const request = new NextRequest('http://localhost/dashboard', {
      headers: new Headers({ cookie: `${SESSION_COOKIE}=valid` })
    });

    const response = await middleware(request);

    expect(response?.headers.get('location')).toBeNull();
  });

  it('redirects authenticated users away from the login path', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const request = new NextRequest('http://localhost/login', {
      headers: new Headers({ cookie: `${SESSION_COOKIE}=valid` })
    });

    const response = await middleware(request);

    expect(response?.headers.get('location')).toBe('http://localhost/');
  });

  it('clears invalid cookies when staying on the login page', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    const request = new NextRequest('http://localhost/login', {
      headers: new Headers({ cookie: `${SESSION_COOKIE}=expired` })
    });

    const response = await middleware(request);

    expect(response?.headers.get('location')).toBeNull();
    expect(response?.headers.get('set-cookie')).toMatch(/syn_session=;/);
  });
});
