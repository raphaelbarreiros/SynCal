'use client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export interface Connector {
  id: string;
  ownerId: string;
  type: 'google' | 'microsoft' | 'html_ics' | 'imap' | 'self_managed';
  displayName: string | null;
  status: 'pending_validation' | 'validated' | 'disabled';
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  calendars?: Calendar[];
}

export interface Calendar {
  id: string;
  connectorId: string;
  providerCalendarId: string;
  displayName: string | null;
  privacyMode: 'original_title' | 'busy_placeholder';
  metadata: Record<string, any>;
}

export interface OAuthProviderCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole?: string;
}

export interface ConnectorCreateRequest {
  type: 'google' | 'microsoft';
  displayName?: string;
  calendars: string[];
  config?: Record<string, any>;
}

export interface OAuthInitiateRequest {
  provider: 'google' | 'microsoft';
}

export interface OAuthInitiateResponse {
  authUrl: string;
  state: string;
}

/**
 * Fetches CSRF token for secure API requests
 */
export async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: 'include',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('Unable to fetch CSRF token');
  }

  const payload = await response.json();
  return payload.token;
}

/**
 * Lists all connectors for the authenticated user
 */
export async function listConnectors(): Promise<Connector[]> {
  const response = await fetch(`${API_BASE_URL}/connectors`, {
    credentials: 'include',
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error('Failed to fetch connectors');
  }

  return response.json();
}

/**
 * Initiates OAuth flow for a provider
 */
export async function initiateOAuth(provider: 'google' | 'microsoft', csrfToken: string): Promise<OAuthInitiateResponse> {
  const response = await fetch(`${API_BASE_URL}/connectors/oauth/initiate`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ provider })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to initiate OAuth: ${error}`);
  }

  return response.json();
}

/**
 * Creates a new connector after OAuth completion
 */
export async function createConnector(data: ConnectorCreateRequest, csrfToken: string): Promise<Connector> {
  const response = await fetch(`${API_BASE_URL}/connectors`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create connector: ${error}`);
  }

  return response.json();
}

/**
 * Gets details for a specific connector
 */
export async function getConnector(id: string): Promise<Connector> {
  const response = await fetch(`${API_BASE_URL}/connectors/${id}`, {
    credentials: 'include',
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Connector not found');
    }
    throw new Error('Failed to fetch connector details');
  }

  return response.json();
}