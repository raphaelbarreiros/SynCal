import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifySessionObject } from '@fastify/session';
import type { AppEnv } from '@syncal/config';
import type { Calendar, Connector } from '@prisma/client';
import { createConnector } from '../../src/services/connectors.js';

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

const now = new Date('2025-01-01T00:00:00.000Z');

beforeEach(() => {
  process.env.ENCRYPTION_KEY = baseEnv.ENCRYPTION_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createConnector – HTML/ICS', () => {
  it('persists validation results and returns masked preview data', async () => {
    const connectorsRepo = {
      create: vi.fn(async (input) => ({
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
      }) satisfies Connector),
      updateValidation: vi.fn(),
      listByOwner: vi.fn()
    } as unknown as {
      create: ReturnType<typeof vi.fn>;
      updateValidation: ReturnType<typeof vi.fn>;
      listByOwner: ReturnType<typeof vi.fn>;
    };

    const calendarsRepo = {
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

    const auditLogsRepo = {
      create: vi.fn(async () => ({
        id: '00000000-0000-4000-8000-000000000000',
        actorId: 'admin-id',
        action: 'connector.created',
        entityType: 'connector',
        entityId: '11111111-1111-4111-8111-111111111111',
        metadata: {},
        createdAt: now
      }))
    };

    const fetchMock = vi.fn(async () =>
      new Response(
        'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:htmlics\nDTSTART:20260101T100000Z\nSUMMARY:Imported\nEND:VEVENT\nEND:VCALENDAR',
        { status: 200 }
      )
    );

    const result = await createConnector({
      body: {
        type: 'html_ics',
        displayName: 'HTML Feed',
        config: {
          feedUrl: 'https://calendar.example.com/feed.ics',
          targetCalendarLabel: 'Ops Calendar'
        }
      },
      session: {} as FastifySessionObject,
      admin: {
        id: 'admin-id',
        email: 'admin@example.com',
        issuedAt: now.toISOString()
      },
      deps: {
        env: baseEnv,
        connectorRegistry: {
          getAdapter() {
            throw new Error('OAuth adapter should not be requested for HTML/ICS connectors');
          }
        },
        connectors: connectorsRepo as unknown as any,
        calendars: calendarsRepo as unknown as any,
        auditLogs: auditLogsRepo as unknown as any,
        prisma: {} as any,
        fetchImpl: fetchMock
      }
    });

    expect(result.type).toBe('html_ics');
    expect(result.status).toBe('validated');
    expect(result.lastSuccessfulFetchAt).toBeTruthy();
    expect(result.previewEvents).toHaveLength(1);
    expect(result.maskedUrl).toBe('https://calendar.example.com/…/feed.ics');
    expect(result.targetCalendarLabel).toBe('Ops Calendar');
    expect(calendarsRepo.upsertMany).toHaveBeenCalledTimes(1);

    const createCall = connectorsRepo.create.mock.calls[0][0];
    const storedConfig = JSON.parse(JSON.stringify(createCall.config));
    expect(storedConfig.targetCalendarLabel).toBe('Ops Calendar');
    expect(storedConfig.validationStatus).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
