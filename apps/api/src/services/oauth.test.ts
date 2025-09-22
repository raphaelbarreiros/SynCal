import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleOAuthProvider, MicrosoftOAuthProvider } from '../services/oauth';
import type { AppEnv } from '@syncal/config';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OAuth Providers', () => {
  const mockGoogleEnv: AppEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test',
    SESSION_SECRET: 'test-session-secret-32-characters',
    ENCRYPTION_KEY: 'test-encryption-key-32-characters',
    LOG_LEVEL: 'info',
    WORKER_HEARTBEAT_INTERVAL_MS: 5000,
    AUTH_SESSION_RATE_LIMIT_MAX: 25,
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3001/auth/google/callback',
    GOOGLE_OAUTH_SCOPES: 'openid email profile https://www.googleapis.com/auth/calendar',
    MS_CLIENT_ID: 'test-ms-client-id',
    MS_CLIENT_SECRET: 'test-ms-client-secret',
    MS_TENANT_ID: 'common',
    MS_REDIRECT_URI: 'http://localhost:3001/auth/microsoft/callback',
    MS_OAUTH_SCOPES: 'openid email profile offline_access Calendars.ReadWrite'
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('GoogleOAuthProvider', () => {
    it('should throw error if credentials not configured', () => {
      const incompleteEnv = { ...mockGoogleEnv, GOOGLE_CLIENT_ID: undefined };
      expect(() => new GoogleOAuthProvider(incompleteEnv)).toThrow('Google OAuth credentials not configured');
    });

    it('should generate correct auth URL', () => {
      const provider = new GoogleOAuthProvider(mockGoogleEnv);
      const state = 'test-state';
      
      const authUrl = provider.getAuthUrl(state);
      
      expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(authUrl).toContain(`client_id=${mockGoogleEnv.GOOGLE_CLIENT_ID}`);
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('access_type=offline');
      expect(authUrl).toContain('prompt=consent');
    });

    it('should exchange code for tokens', async () => {
      const provider = new GoogleOAuthProvider(mockGoogleEnv);
      const mockTokens = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        scope: 'openid email profile https://www.googleapis.com/auth/calendar',
        token_type: 'Bearer'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokens)
      });

      const tokens = await provider.exchangeCodeForTokens('test-code');

      expect(tokens).toEqual(mockTokens);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
      );
    });

    it('should handle token exchange failure', async () => {
      const provider = new GoogleOAuthProvider(mockGoogleEnv);
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('invalid_grant')
      });

      await expect(provider.exchangeCodeForTokens('invalid-code')).rejects.toThrow(
        'Google token exchange failed: invalid_grant'
      );
    });

    it('should fetch user calendars', async () => {
      const provider = new GoogleOAuthProvider(mockGoogleEnv);
      const mockCalendars = {
        items: [
          {
            id: 'primary',
            summary: 'Primary Calendar',
            description: 'Main calendar',
            primary: true,
            accessRole: 'owner'
          },
          {
            id: 'work',
            summary: 'Work',
            description: 'Work events',
            primary: false,
            accessRole: 'owner'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCalendars)
      });

      const calendars = await provider.getCalendars('test-token');

      expect(calendars).toHaveLength(2);
      expect(calendars[0]).toEqual({
        id: 'primary',
        summary: 'Primary Calendar',
        description: 'Main calendar',
        primary: true,
        accessRole: 'owner'
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-token'
          }
        })
      );
    });

    it('should validate access token and get user profile', async () => {
      const provider = new GoogleOAuthProvider(mockGoogleEnv);
      const mockProfile = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      });

      const profile = await provider.validateToken('test-token');

      expect(profile).toEqual(mockProfile);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v1/userinfo',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-token'
          }
        })
      );
    });
  });

  describe('MicrosoftOAuthProvider', () => {
    it('should throw error if credentials not configured', () => {
      const incompleteEnv = { ...mockGoogleEnv, MS_CLIENT_ID: undefined };
      expect(() => new MicrosoftOAuthProvider(incompleteEnv)).toThrow('Microsoft OAuth credentials not configured');
    });

    it('should generate correct auth URL', () => {
      const provider = new MicrosoftOAuthProvider(mockGoogleEnv);
      const state = 'test-state';
      
      const authUrl = provider.getAuthUrl(state);
      
      expect(authUrl).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(authUrl).toContain(`client_id=${mockGoogleEnv.MS_CLIENT_ID}`);
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('response_type=code');
    });

    it('should exchange code for tokens', async () => {
      const provider = new MicrosoftOAuthProvider(mockGoogleEnv);
      const mockTokens = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        scope: 'openid email profile offline_access Calendars.ReadWrite',
        token_type: 'Bearer'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokens)
      });

      const tokens = await provider.exchangeCodeForTokens('test-code');

      expect(tokens).toEqual(mockTokens);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
      );
    });

    it('should fetch user calendars from Microsoft Graph', async () => {
      const provider = new MicrosoftOAuthProvider(mockGoogleEnv);
      const mockCalendars = {
        value: [
          {
            id: 'calendar1',
            name: 'Calendar',
            description: 'Default calendar',
            isDefaultCalendar: true
          },
          {
            id: 'work-calendar',
            name: 'Work Calendar',
            description: 'Work events',
            isDefaultCalendar: false
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCalendars)
      });

      const calendars = await provider.getCalendars('test-token');

      expect(calendars).toHaveLength(2);
      expect(calendars[0]).toEqual({
        id: 'calendar1',
        summary: 'Calendar',
        description: 'Default calendar',
        primary: true,
        accessRole: 'owner'
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me/calendars',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-token'
          }
        })
      );
    });

    it('should validate access token and get user profile from Microsoft Graph', async () => {
      const provider = new MicrosoftOAuthProvider(mockGoogleEnv);
      const mockProfile = {
        id: 'test-user-id',
        mail: 'test@example.com',
        displayName: 'Test User'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      });

      const profile = await provider.validateToken('test-token');

      expect(profile).toEqual({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-token'
          }
        })
      );
    });

    it('should handle userPrincipalName as fallback email', async () => {
      const provider = new MicrosoftOAuthProvider(mockGoogleEnv);
      const mockProfile = {
        id: 'test-user-id',
        userPrincipalName: 'test@contoso.onmicrosoft.com',
        displayName: 'Test User'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      });

      const profile = await provider.validateToken('test-token');

      expect(profile.email).toBe('test@contoso.onmicrosoft.com');
    });
  });
});