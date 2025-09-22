import { randomBytes } from 'node:crypto';
import type { FastifySessionObject } from '@fastify/session';
import type {
  OAuthCallbackPayload,
  OAuthProvider,
  OAuthStateEntry,
  ProviderCalendar
} from '@syncal/connectors';
import type {
  OAuthContextEntry,
  OAuthProvider as OAuthProviderCore
} from '@syncal/core';

const SESSION_KEY = 'oauthFlows' as const;
type PublicCalendar = OAuthContextEntry['discoveredCalendars'][number];

export interface OAuthSessionEntry {
  provider: OAuthProvider;
  state: string;
  codeVerifier?: string;
  scopes: string[];
  createdAt: string;
  payload?: OAuthCallbackPayload;
}

declare module '@fastify/session' {
  interface FastifySessionObject {
    [SESSION_KEY]?: Record<string, OAuthSessionEntry>;
  }
}

function getStore(session: FastifySessionObject): Record<string, OAuthSessionEntry> {
  if (!session[SESSION_KEY]) {
    session[SESSION_KEY] = {};
  }

  return session[SESSION_KEY] as Record<string, OAuthSessionEntry>;
}

export function generateStateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function saveOAuthRequest(
  session: FastifySessionObject,
  entry: OAuthStateEntry & { scopes: string[] }
): OAuthSessionEntry {
  const store = getStore(session);
  const payload: OAuthSessionEntry = {
    provider: entry.provider,
    state: entry.state,
    codeVerifier: entry.codeVerifier,
    scopes: entry.scopes,
    createdAt: entry.createdAt,
    payload: undefined
  };

  store[payload.state] = payload;
  return payload;
}

export function getOAuthSessionEntry(
  session: FastifySessionObject,
  state: string
): OAuthSessionEntry | null {
  const store = getStore(session);
  return store[state] ?? null;
}

export function storeOAuthCallback(
  session: FastifySessionObject,
  state: string,
  callback: OAuthCallbackPayload
): OAuthSessionEntry | null {
  const entry = getOAuthSessionEntry(session, state);
  if (!entry) {
    return null;
  }

  entry.payload = callback;
  return entry;
}

export function consumeOAuthSession(
  session: FastifySessionObject,
  state: string
): OAuthSessionEntry | null {
  const store = getStore(session);
  const entry = store[state];
  if (!entry) {
    return null;
  }

  delete store[state];
  return entry;
}

export function listPublicOAuthContext(session: FastifySessionObject): OAuthContextEntry[] {
  const store = getStore(session);

  return Object.values(store).map((entry) => ({
    provider: entry.provider as OAuthProviderCore,
    state: entry.state,
    profile: entry.payload?.profile
      ? {
          id: entry.payload.profile.id,
          email: entry.payload.profile.email,
          name: entry.payload.profile.name
        }
      : undefined,
    scopes: entry.scopes,
    discoveredCalendars: (entry.payload?.calendars ?? []).map(mapCalendar)
  }));
}

function mapCalendar(calendar: ProviderCalendar): PublicCalendar {
  return {
    id: calendar.id,
    name: calendar.name,
    description: calendar.description,
    timeZone: calendar.timeZone,
    isPrimary: calendar.isPrimary,
    canEdit: calendar.canEdit
  } satisfies PublicCalendar;
}
