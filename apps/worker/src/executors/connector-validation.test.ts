import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectorRegistry, ProviderEventSummary } from '@syncal/connectors';
import { encryptJson } from '@syncal/config';
import { createConnectorValidationExecutor } from './connector-validation.js';

const ENCRYPTION_KEY =
  'base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';

interface PrismaConnectorUpdateArgs {
  where: { id: string };
  data: Record<string, unknown>;
}

describe('createConnectorValidationExecutor', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
  });

  function buildRegistry(fetchMock: ReturnType<typeof vi.fn>): ConnectorRegistry {
    return {
      getAdapter() {
        return {
          provider: 'google',
          fetchUpcomingEvents: fetchMock
        } as unknown as ReturnType<ConnectorRegistry['getAdapter']>;
      }
    } satisfies ConnectorRegistry;
  }

  function createContext(overrides: Partial<PrismaConnectorUpdateArgs['data']> = {}) {
    const connectorId = '11111111-2222-3333-4444-555555555555';
    const fetchMock = vi.fn<[], Promise<ProviderEventSummary>>(async () => ({
      calendarId: 'cal-1',
      total: 2,
      from: '2025-01-01T00:00:00.000Z',
      to: '2025-01-02T00:00:00.000Z'
    }));

    const registry = buildRegistry(fetchMock);

    const connectorRecord = {
      id: connectorId,
      type: 'google',
      credentialsEncrypted: encryptJson({
        provider: 'google',
        tokens: {
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresIn: 3600,
          scope: 'calendar',
          tokenType: 'Bearer',
          obtainedAt: new Date().toISOString(),
          raw: {}
        }
      }),
      configJson: {
        provider: 'google',
        selectedCalendarIds: ['cal-1'],
        validation: { status: 'pending' }
      }
    };

    const findUnique = vi.fn(async () => connectorRecord);
    const update = vi.fn(async (_args: PrismaConnectorUpdateArgs) => undefined);

    const context = {
      registry,
      fetchMock,
      job: {
        connectorId,
        payload: {
          type: 'connector_validation',
          connectorId,
          calendarIds: ['cal-1']
        }
      },
      prisma: {
        connector: {
          findUnique,
          update
        }
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    } as const;

    return { context, overrides };
  }

  it('validates connector calendars and marks connector as validated', async () => {
    const { context } = createContext();

    const executor = createConnectorValidationExecutor({ registry: context.registry });
    const result = await executor(
      context.job as unknown as Parameters<typeof executor>[0],
      {
        prisma: context.prisma as unknown as Parameters<typeof executor>[1]['prisma'],
        logger: context.logger
      } as Parameters<typeof executor>[1]
    );

    expect(result).toEqual({ outcome: 'success', processedEvents: 2, failedEvents: 0 });

    expect(context.prisma.connector.update).toHaveBeenCalledTimes(1);
    const updateArgs = context.prisma.connector.update.mock.calls[0]?.[0] as PrismaConnectorUpdateArgs;
    expect(updateArgs.where.id).toBe(context.job.connectorId);
    expect(updateArgs.data.status).toBe('validated');
    expect(updateArgs.data.lastValidatedAt).toBeInstanceOf(Date);

    const updatedConfig = updateArgs.data.configJson as Record<string, unknown>;
    expect(updatedConfig).toMatchObject({
      validation: {
        status: 'success',
        samples: [
          {
            calendarId: 'cal-1',
            total: 2,
            from: '2025-01-01T00:00:00.000Z',
            to: '2025-01-02T00:00:00.000Z'
          }
        ]
      }
    });
  });

  it('marks connector as pending when validation fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('Unable to reach provider');
    });

    const registry = buildRegistry(fetchMock);

    const connectorId = '11111111-2222-3333-4444-555555555555';
    const connectorRecord = {
      id: connectorId,
      type: 'google',
      credentialsEncrypted: encryptJson({
        provider: 'google',
        tokens: {
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresIn: 3600,
          scope: 'calendar',
          tokenType: 'Bearer',
          obtainedAt: new Date().toISOString(),
          raw: {}
        }
      }),
      configJson: {
        provider: 'google',
        selectedCalendarIds: ['cal-1'],
        validation: { status: 'pending' }
      }
    };

    const prisma = {
      connector: {
        findUnique: vi.fn(async () => connectorRecord),
        update: vi.fn(async (_args: PrismaConnectorUpdateArgs) => undefined)
      }
    };

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const executor = createConnectorValidationExecutor({ registry });
    const result = await executor(
      {
        id: 'job-1',
        payload: { type: 'connector_validation', connectorId, calendarIds: ['cal-1'] }
      } as any,
      { prisma: prisma as any, logger }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('failure');
    expect(result.errorSummary).toBe('Unable to reach provider');

    const updateArgs = prisma.connector.update.mock.calls[0]?.[0] as PrismaConnectorUpdateArgs;
    expect(updateArgs.data.status).toBe('pending_validation');
    expect(updateArgs.data.lastValidatedAt).toBeNull();
    const updatedConfig = updateArgs.data.configJson as Record<string, unknown>;
    expect(updatedConfig).toMatchObject({
      validation: {
        status: 'error',
        error: 'Unable to reach provider'
      }
    });
  });
});
