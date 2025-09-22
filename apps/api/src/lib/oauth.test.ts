import { describe, expect, it } from 'vitest';
import type { FastifySessionObject } from '@fastify/session';
import type { OAuthCallbackPayload } from '@syncal/connectors';
import {
  consumeOAuthSession,
  generateStateToken,
  getOAuthSessionEntry,
  listPublicOAuthContext,
  saveOAuthRequest,
  storeOAuthCallback
} from './oauth.js';

function createSession(): FastifySessionObject {
  return {} as FastifySessionObject;
}

describe('oauth session helpers', () => {
  it('saves and retrieves OAuth state entries', () => {
    const session = createSession();
    const state = generateStateToken(8);
    saveOAuthRequest(session, {
      provider: 'google',
      state,
      codeVerifier: 'verifier',
      createdAt: new Date().toISOString(),
      scopes: ['openid']
    });

    const entry = getOAuthSessionEntry(session, state);
    expect(entry).not.toBeNull();
    expect(entry?.provider).toBe('google');
    expect(entry?.scopes).toEqual(['openid']);
  });

  it('attaches callback payload and removes entries on consumption', () => {
    const session = createSession();
    const state = generateStateToken(8);
    saveOAuthRequest(session, {
      provider: 'microsoft',
      state,
      codeVerifier: 'code',
      createdAt: new Date().toISOString(),
      scopes: ['Calendars.ReadWrite']
    });

    const callback: OAuthCallbackPayload = {
      tokens: {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
        scope: 'Calendars.ReadWrite',
        tokenType: 'Bearer',
        obtainedAt: new Date().toISOString(),
        raw: {}
      },
      profile: {
        id: 'user-1',
        email: 'user@example.com'
      },
      calendars: [
        {
          id: 'cal-1',
          name: 'Primary',
          description: undefined,
          timeZone: 'UTC',
          isPrimary: true,
          canEdit: true,
          raw: {}
        }
      ]
    };

    storeOAuthCallback(session, state, callback);
    const consumed = consumeOAuthSession(session, state);

    expect(consumed).not.toBeNull();
    expect(consumed?.payload?.profile.email).toBe('user@example.com');
    expect(getOAuthSessionEntry(session, state)).toBeNull();
  });

  it('exposes sanitized context without secrets', () => {
    const session = createSession();
    const state = generateStateToken(8);
    saveOAuthRequest(session, {
      provider: 'google',
      state,
      codeVerifier: 'abc',
      createdAt: new Date().toISOString(),
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    storeOAuthCallback(session, state, {
      tokens: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 3600,
        scope: 'calendar',
        tokenType: 'Bearer',
        obtainedAt: new Date().toISOString(),
        raw: {}
      },
      profile: {
        id: 'user',
        name: 'Calendar Admin'
      },
      calendars: [
        {
          id: 'calendar-1',
          name: 'Marketing',
          description: 'Team calendar',
          timeZone: 'UTC',
          isPrimary: false,
          canEdit: true,
          raw: {}
        }
      ]
    });

    const context = listPublicOAuthContext(session);
    expect(context).toHaveLength(1);
    const entry = context[0];
    expect(entry.provider).toBe('google');
    expect(entry.discoveredCalendars[0].id).toBe('calendar-1');
    expect(entry.discoveredCalendars[0]).not.toHaveProperty('raw');
  });
});
