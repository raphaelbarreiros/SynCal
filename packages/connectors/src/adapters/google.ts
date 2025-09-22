import { httpJson } from '../http.js';
import {
  type ConnectorAdapter,
  type OAuthAuthorizationResult,
  type OAuthAuthorizationUrlParams,
  type OAuthExchangeParams,
  type OAuthTokens,
  type ProviderCalendar,
  type ProviderEventSummary,
  type ProviderProfile
} from '../types.js';

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_PROFILE_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_CALENDAR_LIST_ENDPOINT =
  'https://www.googleapis.com/calendar/v3/users/me/calendarList';

function buildAuthorizationUrl(params: OAuthAuthorizationUrlParams): OAuthAuthorizationResult {
  const scope = encodeURIComponent(params.scopes.join(' '));
  const url =
    `${GOOGLE_AUTH_BASE}?response_type=code&access_type=offline&prompt=consent&client_id=${encodeURIComponent(params.clientId)}` +
    `&redirect_uri=${encodeURIComponent(params.redirectUri)}&scope=${scope}&state=${encodeURIComponent(params.state)}` +
    (params.codeChallenge
      ? `&code_challenge=${encodeURIComponent(params.codeChallenge)}&code_challenge_method=S256`
      : '');

  return { authorizationUrl: url };
}

async function exchangeTokens(params: OAuthExchangeParams): Promise<{ tokens: OAuthTokens; profile: ProviderProfile }> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code'
  });

  if (params.codeVerifier) {
    body.set('code_verifier', params.codeVerifier);
  }

  const response = await httpJson<Record<string, unknown>>(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    body: body.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  const tokens: OAuthTokens = {
    accessToken: String(response.access_token ?? ''),
    refreshToken: String(response.refresh_token ?? ''),
    expiresIn: Number(response.expires_in ?? 0),
    scope: String(response.scope ?? params.scopes.join(' ')),
    tokenType: String(response.token_type ?? 'Bearer'),
    idToken: typeof response.id_token === 'string' ? response.id_token : undefined,
    obtainedAt: new Date().toISOString(),
    raw: response
  };

  const profile = await httpJson<Record<string, unknown>>(GOOGLE_PROFILE_ENDPOINT, {
    headers: {
      Authorization: `${tokens.tokenType} ${tokens.accessToken}`
    }
  });

  const normalizedProfile: ProviderProfile = {
    id: String(profile.sub ?? ''),
    email: typeof profile.email === 'string' ? profile.email : undefined,
    name: typeof profile.name === 'string' ? profile.name : undefined,
    locale: typeof profile.locale === 'string' ? profile.locale : undefined
  };

  return { tokens, profile: normalizedProfile };
}

async function listCalendars(tokens: OAuthTokens): Promise<ProviderCalendar[]> {
  const { items } = await httpJson<{ items?: Array<Record<string, unknown>> }>(
    GOOGLE_CALENDAR_LIST_ENDPOINT,
    {
      headers: {
        Authorization: `${tokens.tokenType} ${tokens.accessToken}`
      },
      query: {
        minAccessRole: 'writer'
      }
    }
  );

  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((calendar) => ({
    id: String(calendar.id ?? ''),
    name: String(calendar.summary ?? calendar.id ?? ''),
    description: typeof calendar.description === 'string' ? calendar.description : undefined,
    timeZone: typeof calendar.timeZone === 'string' ? calendar.timeZone : undefined,
    isPrimary: Boolean(calendar.primary),
    canEdit: ['owner', 'writer'].includes(String(calendar.accessRole ?? '')),
    raw: calendar as Record<string, unknown>
  }));
}

async function fetchUpcomingEvents(
  tokens: OAuthTokens,
  calendarId: string,
  windowDays = 7
): Promise<ProviderEventSummary> {
  const now = new Date();
  const to = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const response = await httpJson<{ items?: unknown[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      headers: {
        Authorization: `${tokens.tokenType} ${tokens.accessToken}`
      },
      query: {
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin: now.toISOString(),
        timeMax: to.toISOString(),
        maxResults: 10
      }
    }
  );

  const total = Array.isArray(response.items) ? response.items.length : 0;

  return {
    calendarId,
    total,
    from: now.toISOString(),
    to: to.toISOString()
  } satisfies ProviderEventSummary;
}

export function createGoogleAdapter(): ConnectorAdapter {
  return {
    provider: 'google',
    exchangeCode: exchangeTokens,
    listCalendars,
    fetchUpcomingEvents
  };
}

export function buildGoogleAuthorizationUrl(
  params: OAuthAuthorizationUrlParams
): OAuthAuthorizationResult {
  return buildAuthorizationUrl(params);
}
