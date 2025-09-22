import type { AppEnv } from '@syncal/config';

export interface OAuthProvider {
  getAuthUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<OAuthTokens>;
  getCalendars(accessToken: string): Promise<Calendar[]>;
  validateToken(accessToken: string): Promise<UserProfile>;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
}

export interface Calendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole?: string;
}

export class GoogleOAuthProvider implements OAuthProvider {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private scopes: string[];

  constructor(env: AppEnv) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }
    
    this.clientId = env.GOOGLE_CLIENT_ID;
    this.clientSecret = env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = env.GOOGLE_REDIRECT_URI || `${env.API_BASE_URL || 'http://localhost:3001'}/auth/google/callback`;
    this.scopes = env.GOOGLE_OAUTH_SCOPES ? env.GOOGLE_OAUTH_SCOPES.split(' ') : [
      'openid',
      'email', 
      'profile',
      'https://www.googleapis.com/auth/calendar'
    ];
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state: state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google token exchange failed: ${error}`);
    }

    return response.json();
  }

  async getCalendars(accessToken: string): Promise<Calendar[]> {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch Google calendars: ${error}`);
    }

    const data = await response.json();
    return data.items?.map((item: any) => ({
      id: item.id,
      summary: item.summary,
      description: item.description,
      primary: item.primary,
      accessRole: item.accessRole,
    })) || [];
  }

  async validateToken(accessToken: string): Promise<UserProfile> {
    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to validate Google token: ${error}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name,
    };
  }
}

export class MicrosoftOAuthProvider implements OAuthProvider {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private tenantId: string;
  private scopes: string[];

  constructor(env: AppEnv) {
    if (!env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured');
    }
    
    this.clientId = env.MS_CLIENT_ID;
    this.clientSecret = env.MS_CLIENT_SECRET;
    this.redirectUri = env.MS_REDIRECT_URI || `${env.API_BASE_URL || 'http://localhost:3001'}/auth/microsoft/callback`;
    this.tenantId = env.MS_TENANT_ID || 'common';
    this.scopes = env.MS_OAUTH_SCOPES ? env.MS_OAUTH_SCOPES.split(' ') : [
      'openid',
      'email',
      'profile', 
      'offline_access',
      'Calendars.ReadWrite'
    ];
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      response_mode: 'query',
      scope: this.scopes.join(' '),
      state: state,
    });

    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const response = await fetch(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft token exchange failed: ${error}`);
    }

    return response.json();
  }

  async getCalendars(accessToken: string): Promise<Calendar[]> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch Microsoft calendars: ${error}`);
    }

    const data = await response.json();
    return data.value?.map((item: any) => ({
      id: item.id,
      summary: item.name,
      description: item.description,
      primary: item.isDefaultCalendar,
      accessRole: 'owner', // Microsoft Graph doesn't provide this, assume owner
    })) || [];
  }

  async validateToken(accessToken: string): Promise<UserProfile> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to validate Microsoft token: ${error}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      email: data.mail || data.userPrincipalName,
      name: data.displayName,
    };
  }
}