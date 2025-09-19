import { afterEach, describe, expect, it } from 'vitest';
import { clearCachedEnv, loadEnv } from './index.js';

const originalEnv = { ...process.env };

const requiredEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  SESSION_SECRET: 's'.repeat(32),
  ENCRYPTION_KEY: 'e'.repeat(32),
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
}

afterEach(() => {
  process.env = { ...originalEnv };
  clearCachedEnv();
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
