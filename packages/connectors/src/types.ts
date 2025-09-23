import type {
  ConnectorValidationResult,
  HtmlIcsConnectorConfig
} from '@syncal/core';

export type OAuthProvider = 'google' | 'microsoft';
export type ConnectorProvider = OAuthProvider | 'html_ics';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
  idToken?: string;
  obtainedAt: string;
  raw: Record<string, unknown>;
}

export interface ProviderProfile {
  id: string;
  email?: string;
  name?: string;
  locale?: string;
}

export interface ProviderCalendar {
  id: string;
  name: string;
  description?: string;
  timeZone?: string;
  isPrimary: boolean;
  canEdit: boolean;
  raw: Record<string, unknown>;
}

export interface ProviderEventSummary {
  calendarId: string;
  total: number;
  from: string;
  to: string;
}

export interface OAuthExchangeParams {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  codeVerifier?: string;
  scopes: string[];
}

export interface ConnectorAdapter {
  readonly provider: ConnectorProvider;
  exchangeCode?(params: OAuthExchangeParams): Promise<{
    tokens: OAuthTokens;
    profile: ProviderProfile;
  }>;
  listCalendars?(tokens: OAuthTokens): Promise<ProviderCalendar[]>;
  fetchUpcomingEvents?(tokens: OAuthTokens, calendarId: string, windowDays?: number): Promise<ProviderEventSummary>;
  validate?(config: HtmlIcsConnectorConfig): Promise<ConnectorValidationResult>;
}

export interface HtmlIcsAdapterOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

export interface OAuthAuthorizationUrlParams {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge?: string;
}

export interface OAuthAuthorizationResult {
  authorizationUrl: string;
  codeVerifier?: string;
}

export interface OAuthStateEntry {
  provider: OAuthProvider;
  state: string;
  codeVerifier?: string;
  createdAt: string;
}

export interface OAuthCallbackPayload {
  tokens: OAuthTokens;
  profile: ProviderProfile;
  calendars: ProviderCalendar[];
}
