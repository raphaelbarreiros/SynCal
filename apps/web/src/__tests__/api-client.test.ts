import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCsrfToken,
  listConnectors,
  initiateOAuth,
  createConnector,
  getConnector
} from '../lib/api-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchCsrfToken', () => {
    it('should fetch CSRF token successfully', async () => {
      const mockToken = 'test-csrf-token';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: mockToken })
      });

      const token = await fetchCsrfToken();

      expect(token).toBe(mockToken);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/auth/csrf',
        expect.objectContaining({
          credentials: 'include',
          cache: 'no-store'
        })
      );
    });

    it('should throw error when CSRF fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      await expect(fetchCsrfToken()).rejects.toThrow('Unable to fetch CSRF token');
    });
  });

  describe('listConnectors', () => {
    it('should fetch connectors successfully', async () => {
      const mockConnectors = [
        {
          id: '1',
          ownerId: 'user1',
          type: 'google',
          displayName: 'Google Connector',
          status: 'validated',
          lastValidatedAt: null,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConnectors)
      });

      const connectors = await listConnectors();

      expect(connectors).toEqual(mockConnectors);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/connectors',
        expect.objectContaining({
          credentials: 'include',
          cache: 'no-store'
        })
      );
    });

    it('should throw authentication error for 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(listConnectors()).rejects.toThrow('Authentication required');
    });

    it('should throw generic error for other failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(listConnectors()).rejects.toThrow('Failed to fetch connectors');
    });
  });

  describe('initiateOAuth', () => {
    it('should initiate OAuth flow successfully', async () => {
      const mockResponse = {
        authUrl: 'https://accounts.google.com/oauth/authorize?...',
        state: 'test-state'
      };
      const csrfToken = 'test-csrf-token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await initiateOAuth('google', csrfToken);

      expect(response).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/connectors/oauth/initiate',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ provider: 'google' })
        })
      );
    });

    it('should throw error when OAuth initiation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('OAuth configuration error')
      });

      await expect(initiateOAuth('google', 'token')).rejects.toThrow(
        'Failed to initiate OAuth: OAuth configuration error'
      );
    });
  });

  describe('createConnector', () => {
    it('should create connector successfully', async () => {
      const mockConnector = {
        id: '1',
        ownerId: 'user1',
        type: 'google' as const,
        displayName: 'Google Connector',
        status: 'pending_validation' as const,
        lastValidatedAt: null,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      const createRequest = {
        type: 'google' as const,
        displayName: 'Test Connector',
        calendars: ['primary', 'work']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConnector)
      });

      const connector = await createConnector(createRequest, 'csrf-token');

      expect(connector).toEqual(mockConnector);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/connectors',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'csrf-token'
          },
          body: JSON.stringify(createRequest)
        })
      );
    });

    it('should throw error when connector creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Validation error')
      });

      await expect(
        createConnector({ type: 'google', calendars: [] }, 'token')
      ).rejects.toThrow('Failed to create connector: Validation error');
    });
  });

  describe('getConnector', () => {
    it('should fetch single connector successfully', async () => {
      const mockConnector = {
        id: '1',
        ownerId: 'user1',
        type: 'microsoft',
        displayName: 'Microsoft Connector',
        status: 'validated',
        lastValidatedAt: '2023-01-01T00:00:00Z',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConnector)
      });

      const connector = await getConnector('1');

      expect(connector).toEqual(mockConnector);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/connectors/1',
        expect.objectContaining({
          credentials: 'include',
          cache: 'no-store'
        })
      );
    });

    it('should throw not found error for 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(getConnector('1')).rejects.toThrow('Connector not found');
    });
  });
});