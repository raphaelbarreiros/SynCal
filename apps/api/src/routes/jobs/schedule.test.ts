import Fastify from 'fastify';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SyncJob } from '@prisma/client';
import { ScheduleJobRequestSchema } from '@syncal/core';
import { jobsScheduleRoutes } from './schedule.js';

interface MockPrisma {
  syncPair: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  connectorFailureStat: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  alert: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  syncJob: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

function createApp(): { app: ReturnType<typeof Fastify>; prisma: MockPrisma } {
  const prisma: MockPrisma = {
    syncPair: {
      findUnique: vi.fn()
    },
    connectorFailureStat: {
      findUnique: vi.fn()
    },
    alert: {
      findFirst: vi.fn()
    },
    syncJob: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    $transaction: vi.fn()
  };

  prisma.$transaction.mockImplementation(async (handler) => handler(prisma));

  const app = Fastify();
  app.decorate('prisma', prisma as unknown as typeof app.prisma);
  app.decorate('requireAdmin', async () => {});
  app.decorate('csrfProtection', async () => {});
  app.register(jobsScheduleRoutes);

  return { app, prisma };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /jobs/schedule', () => {
  it('schedules a new job and returns 202', async () => {
    const { app, prisma } = createApp();

    const pairId = '123e4567-e89b-12d3-a456-426614174000';
    const connectorId = '223e4567-e89b-12d3-a456-426614174000';

    const createdJob = {
      id: 'job-1',
      pairId,
      connectorId,
      status: 'pending'
    } as SyncJob;

    prisma.syncPair.findUnique.mockResolvedValue({
      primaryCalendar: { connectorId }
    });
    prisma.connectorFailureStat.findUnique.mockResolvedValue(null);
    prisma.syncJob.findFirst.mockResolvedValue(null);
    prisma.syncJob.create.mockResolvedValue(createdJob);

    await app.ready();

    const payload = {
      pairId,
      window: {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-01T01:00:00Z'
      },
      payload: { reason: 'test' }
    } as const;

    const parseResult = ScheduleJobRequestSchema.safeParse(payload);
    expect(parseResult.success).toBe(true);

    const response = await app.inject({
      method: 'POST',
      url: '/jobs/schedule',
      headers: {
        'content-type': 'application/json'
      },
      payload
    });

    const body = response.json();
    expect(response.statusCode).toBe(202);
    expect(body.jobId).toBe('job-1');
    expect(prisma.syncJob.create).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('returns existing job when idempotency key matches', async () => {
    const { app, prisma } = createApp();

    const pairId = '123e4567-e89b-12d3-a456-426614174000';
    const connectorId = '223e4567-e89b-12d3-a456-426614174000';

    const existing = {
      id: 'job-existing',
      pairId,
      connectorId,
      status: 'pending',
      idempotencyKey: 'abc'
    } as SyncJob;

    prisma.syncPair.findUnique.mockResolvedValue({
      primaryCalendar: { connectorId }
    });
    prisma.connectorFailureStat.findUnique.mockResolvedValue(null);
    prisma.syncJob.findFirst.mockResolvedValue(existing);

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/jobs/schedule',
      headers: {
        'idempotency-key': 'abc',
        'content-type': 'application/json'
      },
      payload: {
        pairId,
        window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-01T01:00:00Z'
        }
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.jobId).toBe('job-existing');
    expect(prisma.syncJob.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 409 when connector is paused', async () => {
    const { app, prisma } = createApp();

    const pairId = '123e4567-e89b-12d3-a456-426614174000';
    const connectorId = '223e4567-e89b-12d3-a456-426614174000';

    prisma.syncPair.findUnique.mockResolvedValue({
      primaryCalendar: { connectorId }
    });
    prisma.connectorFailureStat.findUnique.mockResolvedValue({
      pausedUntil: new Date(Date.now() + 60_000),
      consecutiveFailures: 5
    });
    prisma.alert.findFirst.mockResolvedValue({ message: 'Paused due to failures' });

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/jobs/schedule',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        pairId,
        window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-01T01:00:00Z'
        }
      }
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.error).toBe('connector_paused');
    expect(body.message).toContain('Paused');

    await app.close();
  });
});
