import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '@syncal/config';
import type { AdminUser } from '@prisma/client';
import type { LightMyRequestResponse } from 'light-my-request';
import sessionPlugin from '../../src/plugins/session.js';
import securityPlugin from '../../src/plugins/security.js';
import authGuardPlugin from '../../src/plugins/auth-guard.js';
import { sessionRoutes } from '../../src/routes/auth/session.js';
import { hashPassword } from '../../src/services/password.js';
import type { AdminSession } from '../../src/lib/session.js';

const baseEnv: AppEnv = {
  NODE_ENV: 'test',
  PORT: 3001,
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  SESSION_SECRET: 's'.repeat(64),
  ENCRYPTION_KEY: 'e'.repeat(64),
  INITIAL_ADMIN_EMAIL: undefined,
  INITIAL_ADMIN_PASSWORD: undefined,
  LOG_LEVEL: 'silent',
  WORKER_HEARTBEAT_INTERVAL_MS: 5000,
  AUTH_SESSION_RATE_LIMIT_MAX: 25
};

interface AdminRepoStub {
  count: ReturnType<typeof vi.fn>;
  findByEmail: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

interface AuditRepoStub {
  create: ReturnType<typeof vi.fn>;
}

interface TestContext {
  app: FastifyInstance;
  adminRepo: AdminRepoStub;
  auditRepo: AuditRepoStub;
}

function extractCookies(response: LightMyRequestResponse): string {
  const setCookie = response.headers['set-cookie'];
  if (!setCookie) {
    return '';
  }

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((item) => item.split(';')[0]).join('; ');
}

async function createTestApp(overrides: Partial<AppEnv> = {}): Promise<TestContext> {
  const app = Fastify({ logger: false });
  const adminRepo: AdminRepoStub = {
    count: vi.fn().mockResolvedValue(1),
    findByEmail: vi.fn(),
    create: vi.fn()
  };
  const auditRepo: AuditRepoStub = {
    create: vi.fn()
  };

  app.decorate('appConfig', { ...baseEnv, ...overrides });

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, payload, done) => {
    try {
      const parsed = payload ? JSON.parse(payload as string) : {};
      done(null, parsed);
    } catch (error) {
      done(error as Error);
    }
  });
  app.decorate('repos', { adminUsers: adminRepo, auditLogs: auditRepo });

  await app.register(sessionPlugin);
  await app.register(securityPlugin);
  await app.register(authGuardPlugin);
  await app.register(sessionRoutes);

  await app.ready();

  return { app, adminRepo, auditRepo };
}

describe('Auth session routes', () => {
  let context: TestContext | null = null;

  afterEach(async () => {
    if (context) {
      await context.app.close();
      context = null;
    }
    vi.restoreAllMocks();
  });

  it('creates a session for valid credentials', async () => {
    context = await createTestApp();
    const password = 'AdminPassword123!';
    const passwordHash = await hashPassword(password);
    const admin: AdminUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@example.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    context.adminRepo.findByEmail.mockResolvedValue(admin);

    const csrfResponse = await context.app.inject({ method: 'GET', url: '/auth/csrf' });
    const csrfToken = csrfResponse.json<{ token: string }>().token;
    const csrfCookies = extractCookies(csrfResponse);

    const loginPayload = JSON.stringify({
      email: 'admin@example.com',
      password
    });

    const response = await context.app.inject({
      method: 'POST',
      url: '/auth/session',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(loginPayload).toString(),
        'x-csrf-token': csrfToken,
        cookie: csrfCookies
      },
      body: loginPayload
    });

    expect(response.statusCode).toBe(204);
    expect(context.adminRepo.findByEmail).toHaveBeenCalledWith('admin@example.com');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('rejects invalid credentials with 401', async () => {
    context = await createTestApp();
    const passwordHash = await hashPassword('CorrectPassword1!');
    context.adminRepo.findByEmail.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@example.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies AdminUser);

    const csrfResponse = await context.app.inject({ method: 'GET', url: '/auth/csrf' });
    const csrfToken = csrfResponse.json<{ token: string }>().token;
    const csrfCookies = extractCookies(csrfResponse);

    const invalidPayload = JSON.stringify({
      email: 'admin@example.com',
      password: 'WrongPassword!'
    });

    const response = await context.app.inject({
      method: 'POST',
      url: '/auth/session',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(invalidPayload).toString(),
        'x-csrf-token': csrfToken,
        cookie: csrfCookies
      },
      body: invalidPayload
    });

    expect(response.statusCode).toBe(401);
  });

  it('destroys a session on logout', async () => {
    context = await createTestApp();
    const password = 'AdminPassword123!';
    const passwordHash = await hashPassword(password);
    const admin: AdminUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@example.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    context.adminRepo.findByEmail.mockResolvedValue(admin);

    const csrfForLogin = await context.app.inject({ method: 'GET', url: '/auth/csrf' });
    const loginCsrfToken = csrfForLogin.json<{ token: string }>().token;
    const loginCookies = extractCookies(csrfForLogin);

    const loginPayload = JSON.stringify({
      email: 'admin@example.com',
      password
    });

    const loginResponse = await context.app.inject({
      method: 'POST',
      url: '/auth/session',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(loginPayload).toString(),
        'x-csrf-token': loginCsrfToken,
        cookie: loginCookies
      },
      body: loginPayload
    });

    expect(loginResponse.statusCode).toBe(204);
    const sessionCookies = extractCookies(loginResponse);

    const csrfForLogout = await context.app.inject({
      method: 'GET',
      url: '/auth/csrf',
      headers: {
        cookie: sessionCookies
      }
    });
    const logoutCsrfToken = csrfForLogout.json<{ token: string }>().token;
    const additionalCookies = extractCookies(csrfForLogout);
    const logoutCookies = [sessionCookies, additionalCookies]
      .filter((value) => Boolean(value))
      .join('; ');

    const logoutResponse = await context.app.inject({
      method: 'DELETE',
      url: '/auth/session',
      headers: {
        'x-csrf-token': logoutCsrfToken,
        cookie: logoutCookies
      }
    });

    expect(logoutResponse.statusCode).toBe(204);
  });

  it('returns session details when authenticated', async () => {
    context = await createTestApp();
    const password = 'AdminPassword123!';
    const passwordHash = await hashPassword(password);
    const admin: AdminUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@example.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    context.adminRepo.findByEmail.mockResolvedValue(admin);

    const csrfResponse = await context.app.inject({ method: 'GET', url: '/auth/csrf' });
    const csrfToken = csrfResponse.json<{ token: string }>().token;
    const csrfCookies = extractCookies(csrfResponse);

    const loginPayload = JSON.stringify({
      email: 'admin@example.com',
      password
    });

    const loginResponse = await context.app.inject({
      method: 'POST',
      url: '/auth/session',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(loginPayload).toString(),
        'x-csrf-token': csrfToken,
        cookie: csrfCookies
      },
      body: loginPayload
    });

    expect(loginResponse.statusCode).toBe(204);
    const sessionCookies = extractCookies(loginResponse);

    const sessionResponse = await context.app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: {
        cookie: sessionCookies
      }
    });

    expect(sessionResponse.statusCode).toBe(200);
    const payload = sessionResponse.json<{ admin: AdminSession }>();
    expect(payload.admin).toMatchObject({
      id: admin.id,
      email: admin.email
    });
    expect(typeof payload.admin.issuedAt).toBe('string');
  });

  it('returns 401 when reading session without authentication', async () => {
    context = await createTestApp();

    const response = await context.app.inject({
      method: 'GET',
      url: '/auth/session'
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when deleting a session without authentication', async () => {
    context = await createTestApp();

    const csrfResponse = await context.app.inject({ method: 'GET', url: '/auth/csrf' });
    const csrfToken = csrfResponse.json<{ token: string }>().token;

    const response = await context.app.inject({
      method: 'DELETE',
      url: '/auth/session',
      headers: {
        'x-csrf-token': csrfToken
      }
    });

    expect(response.statusCode).toBe(401);
  });
});
