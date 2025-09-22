import { afterEach, afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  clearCachedEnv,
  loadEnv,
  encryptSecret,
  decryptSecret,
  clearCachedKey
} from './index.js';

const originalEnv = { ...process.env };

const requiredEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  SESSION_SECRET: 's'.repeat(32),
  ENCRYPTION_KEY: 'base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
  APP_BASE_URL: 'http://localhost:3000',
  API_BASE_URL: 'http://localhost:3001',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3001/auth/google/callback',
  GOOGLE_OAUTH_SCOPES: 'openid email profile https://www.googleapis.com/auth/calendar',
  MS_CLIENT_ID: 'microsoft-client-id',
  MS_CLIENT_SECRET: 'microsoft-client-secret',
  MS_TENANT_ID: 'common',
  MS_REDIRECT_URI: 'http://localhost:3001/auth/microsoft/callback',
  MS_OAUTH_SCOPES: 'openid email profile offline_access Calendars.ReadWrite',
  LOG_LEVEL: 'info',
  WORKER_HEARTBEAT_INTERVAL_MS: '5000'
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = {
    ...originalEnv,
    ...requiredEnv,
    ...overrides
  };
  clearCachedEnv();
  clearCachedKey();
}

afterEach(() => {
  process.env = { ...originalEnv };
  clearCachedEnv();
  clearCachedKey();
});

describe('environment configuration', () => {
  it('loads optional admin credentials when provided', () => {
    setEnv({
      INITIAL_ADMIN_EMAIL: 'admin@example.com',
      INITIAL_ADMIN_PASSWORD: 'AdminPassword123!'
    });

    const env = loadEnv();

    expect(env.INITIAL_ADMIN_EMAIL).toBe('admin@example.com');
    expect(env.INITIAL_ADMIN_PASSWORD).toBe('AdminPassword123!');
  });

  it('allows optional admin credentials to be omitted', () => {
    setEnv();

    const env = loadEnv();
    expect(env.INITIAL_ADMIN_EMAIL).toBeUndefined();
    expect(env.INITIAL_ADMIN_PASSWORD).toBeUndefined();
  });

  it('throws when admin email is invalid', () => {
    setEnv({
      INITIAL_ADMIN_EMAIL: 'not-an-email'
    });

    expect(() => loadEnv()).toThrowError(/INITIAL_ADMIN_EMAIL/);
  });

  it('throws when admin password is too short', () => {
    setEnv({
      INITIAL_ADMIN_PASSWORD: 'short'
    });

    expect(() => loadEnv()).toThrowError(/INITIAL_ADMIN_PASSWORD/);
  });
});

describe('encryption helpers', () => {
  beforeAll(() => {
    setEnv();
  });

  afterAll(() => {
    setEnv();
  });

  it('encrypts and decrypts strings round-trip', () => {
    const plaintext = 'super secret token';
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).toBeInstanceOf(Buffer);
    expect(encrypted.byteLength).toBeGreaterThan(plaintext.length);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted.toString('utf8')).toBe(plaintext);
  });
});
