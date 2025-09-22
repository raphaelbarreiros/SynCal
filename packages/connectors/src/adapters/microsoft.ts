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

const MICROSOFT_AUTH_BASE = 'https://login.microsoftonline.com';
const MICROSOFT_TOKEN_PATH = 'oauth2/v2.0/token';
const MICROSOFT_AUTHORIZE_PATH = 'oauth2/v2.0/authorize';
const MICROSOFT_ME_ENDPOINT = 'https://graph.microsoft.com/v1.0/me';
const MICROSOFT_CALENDARS_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/calendars';

function buildAuthorizationUrl(
  tenantId: string,
  params: OAuthAuthorizationUrlParams
): OAuthAuthorizationResult {
  const scope = encodeURIComponent(params.scopes.join(' '));
  const base = `${MICROSOFT_AUTH_BASE}/${tenantId}/${MICROSOFT_AUTHORIZE_PATH}`;

  const url =
    `${base}?response_type=code&response_mode=query&client_id=${encodeURIComponent(params.clientId)}` +
    `&redirect_uri=${encodeURIComponent(params.redirectUri)}&scope=${scope}&state=${encodeURIComponent(params.state)}` +
    (params.codeChallenge
      ? `&code_challenge=${encodeURIComponent(params.codeChallenge)}&code_challenge_method=S256`
      : '');

  return { authorizationUrl: url };
}

async function exchangeTokens(
  tenantId: string,
  params: OAuthExchangeParams
): Promise<{ tokens: OAuthTokens; profile: ProviderProfile }> {
  const tokenEndpoint = `${MICROSOFT_AUTH_BASE}/${tenantId}/${MICROSOFT_TOKEN_PATH}`;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    scope: params.scopes.join(' ')
  });

  if (params.codeVerifier) {
    body.set('code_verifier', params.codeVerifier);
  }

  const response = await httpJson<Record<string, unknown>>(tokenEndpoint, {
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

  const profileResponse = await httpJson<Record<string, unknown>>(MICROSOFT_ME_ENDPOINT, {
    headers: {
      Authorization: `${tokens.tokenType} ${tokens.accessToken}`
    }
  });

  const profile: ProviderProfile = {
    id: String(profileResponse.id ?? ''),
    email: typeof profileResponse.mail === 'string' ? profileResponse.mail : undefined,
    name: typeof profileResponse.displayName === 'string' ? profileResponse.displayName : undefined,
    locale: typeof profileResponse.preferredLanguage === 'string'
      ? profileResponse.preferredLanguage
      : undefined
  };

  return { tokens, profile };
}

async function listCalendars(tokens: OAuthTokens): Promise<ProviderCalendar[]> {
  const response = await httpJson<{ value?: Array<Record<string, unknown>> | null }>(
    MICROSOFT_CALENDARS_ENDPOINT,
    {
      headers: {
        Authorization: `${tokens.tokenType} ${tokens.accessToken}`
      }
    }
  );

  if (!Array.isArray(response.value)) {
    return [];
  }

  return response.value.map((calendar) => ({
    id: String(calendar.id ?? ''),
    name: String(calendar.name ?? calendar.id ?? ''),
    description: typeof calendar.hexColor === 'string' ? calendar.hexColor : undefined,
    timeZone: typeof calendar.timeZone === 'string' ? calendar.timeZone : undefined,
    isPrimary: Boolean(calendar.isDefaultCalendar),
    canEdit: true,
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

  const endpoint = `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events`;

  const response = await httpJson<{ value?: unknown[] }>(endpoint, {
    headers: {
      Authorization: `${tokens.tokenType} ${tokens.accessToken}`
    },
    query: {
      startDateTime: now.toISOString(),
      endDateTime: to.toISOString(),
      '$top': 10,
      '$orderby': 'start/dateTime'
    }
  });

  const total = Array.isArray(response.value) ? response.value.length : 0;

  return {
    calendarId,
    total,
    from: now.toISOString(),
    to: to.toISOString()
  } satisfies ProviderEventSummary;
}

export interface MicrosoftAdapterOptions {
  tenantId: string;
}

export function createMicrosoftAdapter(options: MicrosoftAdapterOptions): ConnectorAdapter {
  return {
    provider: 'microsoft',
    exchangeCode: (params) => exchangeTokens(options.tenantId, params),
    listCalendars,
    fetchUpcomingEvents
  };
}

export function buildMicrosoftAuthorizationUrl(
  options: MicrosoftAdapterOptions,
  params: OAuthAuthorizationUrlParams
): OAuthAuthorizationResult {
  return buildAuthorizationUrl(options.tenantId, params);
}
