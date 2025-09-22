import Fastify from 'fastify';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { AppEnv } from '@syncal/config';
import { healthRoutes } from './health.js';

const baseEnv: AppEnv = {
  NODE_ENV: 'test',
  PORT: 3001,
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  SESSION_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: 'y'.repeat(32),
  APP_BASE_URL: 'http://localhost:3000',
  API_BASE_URL: 'http://localhost:3001',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3001/auth/google/callback',
  GOOGLE_OAUTH_SCOPES: 'openid email profile https://www.googleapis.com/auth/calendar',
  MS_CLIENT_ID: 'ms-client-id',
  MS_CLIENT_SECRET: 'ms-client-secret',
  MS_TENANT_ID: 'common',
  MS_REDIRECT_URI: 'http://localhost:3001/auth/microsoft/callback',
  MS_OAUTH_SCOPES: 'openid email profile offline_access Calendars.ReadWrite',
  INITIAL_ADMIN_EMAIL: undefined,
  INITIAL_ADMIN_PASSWORD: undefined,
  LOG_LEVEL: 'info',
  WORKER_HEARTBEAT_INTERVAL_MS: 5000,
  AUTH_SESSION_RATE_LIMIT_MAX: 25
};

function createApp(overrides: Partial<AppEnv> = {}) {
  const app = Fastify();
  const queryMock = vi.fn().mockResolvedValue(1);
  const prisma = {
    $queryRaw: queryMock,
    $queryRawUnsafe: queryMock
  } as const;

  app.decorate('prisma', prisma as any);
  app.appConfig = { ...baseEnv, ...overrides };

  app.addHook('onClose', async () => {
    vi.restoreAllMocks();
  });

  return { app, queryMock };
}

describe('GET /healthz', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 when dependencies are healthy', async () => {
    const { app } = createApp();
    await app.register(healthRoutes);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.status).toBe('ok');
    expect(payload.db).toBe('connected');
    expect(payload.encryptionKey).toBe('ready');

    await app.close();
  });

  it('returns 503 when the database check fails', async () => {
    const { app, queryMock } = createApp();
    queryMock.mockRejectedValue(new Error('db down'));
    await app.register(healthRoutes);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(503);
    const payload = response.json();
    expect(payload.status).toBe('degraded');
    expect(payload.db).toBe('disconnected');
    expect(payload.reason).toContain('database');

    await app.close();
  });

  it('returns 503 when encryption key is missing', async () => {
    const { app } = createApp({ ENCRYPTION_KEY: '' });
    await app.register(healthRoutes);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(503);
    const payload = response.json();
    expect(payload.status).toBe('degraded');
    expect(payload.encryptionKey).toBe('missing');
    expect(payload.reason).toContain('encryption');

    await app.close();
  });
});
