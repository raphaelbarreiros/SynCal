import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifySessionObject } from '@fastify/session';
import type { AppEnv } from '@syncal/config';
import type {
  AuditLog,
  Calendar,
  Connector,
  PrismaClient,
  SyncJob,
  SyncPair
} from '@prisma/client';
import type { ConnectorAdapter } from '@syncal/connectors';
import type { ConnectorRegistry } from '../../src/plugins/connectors.js';
import {
  createConnector,
  handleOAuthCallback,
  startOAuthFlow
} from '../../src/services/connectors.js';
import { saveOAuthRequest } from '../../src/lib/oauth.js';

const baseEnv: AppEnv = {
  NODE_ENV: 'test',
  PORT: 3001,
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  SESSION_SECRET: 'session-secret-session-secret-session-secret-session-secret',
  ENCRYPTION_KEY: 'base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
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
  LOG_LEVEL: 'silent',
  WORKER_HEARTBEAT_INTERVAL_MS: 5000,
  AUTH_SESSION_RATE_LIMIT_MAX: 25
};

const originalEncryptionKey = process.env.ENCRYPTION_KEY;

interface Repositories {
  connectors: {
    create: ReturnType<typeof vi.fn>;
    updateValidation: ReturnType<typeof vi.fn>;
    listByOwner: ReturnType<typeof vi.fn>;
  };
  calendars: {
    upsertMany: ReturnType<typeof vi.fn>;
    listByConnector: ReturnType<typeof vi.fn>;
  };
  auditLogs: {
    create: ReturnType<typeof vi.fn>;
  };
}

interface PrismaStubs {
  syncPair: {
    upsert: ReturnType<typeof vi.fn>;
  };
  syncJob: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

interface TestContext {
  session: FastifySessionObject;
  env: AppEnv;
  registry: ConnectorRegistry;
  adapters: Record<'google' | 'microsoft', ConnectorAdapter>;
  repos: Repositories;
  prisma: PrismaClient;
  now: Date;
}

function createAdapter(provider: 'google' | 'microsoft'): ConnectorAdapter {
  return {
    provider,
    exchangeCode: vi.fn(),
    listCalendars: vi.fn(),
    fetchUpcomingEvents: vi.fn()
  };
}

function createContext(): TestContext {
  const now = new Date('2025-01-01T00:00:00.000Z');

  const adapters: Record<'google' | 'microsoft', ConnectorAdapter> = {
    google: createAdapter('google'),
    microsoft: createAdapter('microsoft')
  };

  const registry: ConnectorRegistry = {
    getAdapter(provider) {
      return adapters[provider];
    }
  } as ConnectorRegistry;

  let storedConnector: Connector | null = null;

  const connectorsRepo: Repositories['connectors'] = {
    create: vi.fn(async (input) => {
      storedConnector = {
        id: '11111111-1111-4111-8111-111111111111',
        ownerId: input.ownerId,
        type: input.type,
        displayName: input.displayName ?? null,
        status: input.status ?? 'pending_validation',
        credentialsEncrypted: input.credentialsEncrypted,
        configJson: input.config,
        lastValidatedAt: input.lastValidatedAt ?? null,
        createdAt: now,
        updatedAt: now
      } satisfies Connector;
      return storedConnector;
    }),
    updateValidation: vi.fn(async ({ id, status, lastValidatedAt, config }) => {
      if (!storedConnector || storedConnector.id !== id) {
        throw new Error('Connector not created');
      }

      storedConnector = {
        ...storedConnector,
        status,
        lastValidatedAt: lastValidatedAt ?? null,
        configJson: config ?? storedConnector.configJson,
        updatedAt: now
      };

      return storedConnector;
    }),
    listByOwner: vi.fn(async () => (storedConnector ? [storedConnector] : []))
  };

  const calendarsRepo: Repositories['calendars'] = {
    upsertMany: vi.fn(async (inputs) =>
      inputs.map<Calendar>((input, index) => ({
        id: index === 0
          ? '22222222-2222-4222-8222-222222222222'
          : '22222222-2222-4222-8222-222222222223',
        connectorId: input.connectorId,
        providerCalendarId: input.providerCalendarId,
        displayName: input.displayName ?? null,
        privacyMode: input.privacyMode,
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now
      }))
    ),
    listByConnector: vi.fn(async () => [])
  };

  const auditRepo: Repositories['auditLogs'] = {
    create: vi.fn(async (input) => ({
      id: '00000000-0000-0000-0000-00000000aaaa',
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      createdAt: now
    } satisfies AuditLog))
  };

  const prismaStubs: PrismaStubs = {
    syncPair: {
      upsert: vi.fn(async () => ({
        id: '33333333-3333-4333-8333-333333333333',
        primaryCalendarId: '22222222-2222-4222-8222-222222222222',
        secondaryCalendarId: '22222222-2222-4222-8222-222222222222',
        fallbackOrder: [],
        createdAt: now,
        updatedAt: now
      } satisfies SyncPair))
    },
    syncJob: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({
        id: '44444444-4444-4444-8444-444444444444',
        pairId: '33333333-3333-4333-8333-333333333333',
        connectorId: '11111111-1111-4111-8111-111111111111',
        windowStart: now,
        windowEnd: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        payload: {},
        status: 'pending',
        priority: 0,
        retryCount: 0,
        maxRetries: 5,
        nextRunAt: new Date(now.getTime() + 60 * 60 * 1000),
        lastError: null,
        idempotencyKey: null,
        createdAt: now,
        updatedAt: now
      } satisfies SyncJob))
    }
  };

  const prisma = {
    syncPair: prismaStubs.syncPair,
    syncJob: prismaStubs.syncJob
  } as unknown as PrismaClient;

  const session = {} as FastifySessionObject;

  process.env.ENCRYPTION_KEY = baseEnv.ENCRYPTION_KEY;

  return {
    session,
    env: { ...baseEnv },
    registry,
    adapters,
    repos: {
      connectors: connectorsRepo,
      calendars: calendarsRepo,
      auditLogs: auditRepo
    },
    prisma,
    now
  };
}

describe('Connector OAuth flows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  it('completes connector creation and queues validation job', async () => {
    const context = createContext();
    vi.setSystemTime(context.now);

    const { adapters, session, env, registry, repos, prisma } = context;

    const calendars = [
      {
        id: 'cal-primary',
        name: 'Primary',
        description: 'Main calendar',
        timeZone: 'UTC',
        isPrimary: true,
        canEdit: true,
        raw: {}
      }
    ];

    adapters.google.exchangeCode = vi.fn(async () => ({
      tokens: {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
        scope: 'calendar',
        tokenType: 'Bearer',
        obtainedAt: context.now.toISOString(),
        raw: {}
      },
      profile: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Calendar Admin'
      }
    }));

    adapters.google.listCalendars = vi.fn(async () => calendars);
    adapters.google.fetchUpcomingEvents = vi.fn(async (_tokens, calendarId) => ({
      calendarId,
      total: 3,
      from: context.now.toISOString(),
      to: new Date(context.now.getTime() + 15 * 60 * 1000).toISOString()
    }));

    const start = startOAuthFlow(
      session,
      { provider: 'google' },
      {
        env,
        connectorRegistry: registry,
        connectors: repos.connectors,
        calendars: repos.calendars,
        auditLogs: repos.auditLogs,
        prisma
      }
    );

    await handleOAuthCallback(
      session,
      'google',
      { code: 'auth-code', state: start.state },
      {
        env,
        connectorRegistry: registry,
        connectors: repos.connectors,
        calendars: repos.calendars,
        auditLogs: repos.auditLogs,
        prisma
      }
    );

    const response = await createConnector({
      body: {
        type: 'google',
        state: start.state,
        displayName: 'Marketing Google Workspace',
        selectedCalendars: [
          {
            providerCalendarId: 'cal-primary',
            displayName: 'Marketing',
            privacyMode: 'busy_placeholder'
          }
        ]
      },
      session,
      admin: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@example.com',
        issuedAt: context.now.toISOString()
      },
      deps: {
        env,
        connectorRegistry: registry,
        connectors: repos.connectors,
        calendars: repos.calendars,
        auditLogs: repos.auditLogs,
        prisma
      }
    });

    expect(response.status).toBe('validated');
    expect(response.config?.validation?.status).toBe('success');
    expect(repos.connectors.create).toHaveBeenCalled();
    expect(repos.connectors.updateValidation).toHaveBeenCalled();
    expect(prisma.syncPair.upsert).toHaveBeenCalled();
    expect(prisma.syncJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          connectorId: expect.any(String),
          payload: expect.objectContaining({ type: 'connector_validation' })
        })
      })
    );
  });

  it('throws when consent is denied', async () => {
    const context = createContext();
    const { session, env, registry, repos, prisma } = context;

    await expect(
      handleOAuthCallback(
        session,
        'google',
        { error: 'access_denied', error_description: 'User denied', state: 'state' },
        {
          env,
          connectorRegistry: registry,
          connectors: repos.connectors,
          calendars: repos.calendars,
          auditLogs: repos.auditLogs,
          prisma
        }
      )
    ).rejects.toThrow('User denied');
  });

  it('propagates exchange failures and skips validation scheduling when state missing', async () => {
    const context = createContext();
    vi.setSystemTime(context.now);

    const { adapters, session, env, registry, repos, prisma } = context;
    const state = 'state-token';

    adapters.google.exchangeCode = vi.fn(async () => {
      throw new Error('exchange failed');
    });

    saveOAuthRequest(session, {
      provider: 'google',
      state,
      codeVerifier: 'verifier',
      scopes: ['calendar'],
      createdAt: context.now.toISOString()
    });

    await expect(
      handleOAuthCallback(
        session,
        'google',
        { code: 'bad-code', state },
        {
          env,
          connectorRegistry: registry,
          connectors: repos.connectors,
          calendars: repos.calendars,
          auditLogs: repos.auditLogs,
          prisma
        }
      )
    ).rejects.toThrow('exchange failed');

    expect(prisma.syncJob.create).not.toHaveBeenCalled();
  });
});
