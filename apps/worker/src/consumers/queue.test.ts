import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { SyncJob } from '@prisma/client';
import type { AppLogger } from '@syncal/config';
import { QueueConsumer } from './queue.js';
import { calculateNextRunAt } from '@syncal/core';

vi.mock('../telemetry/metrics.js', () => {
  return {
    observeJobDuration: vi.fn(),
    recordJobStatus: vi.fn(),
    recordRetry: vi.fn(),
    refreshQueueDepth: vi.fn().mockResolvedValue(undefined)
  };
});

const metrics = (await import('../telemetry/metrics.js')) as typeof import('../telemetry/metrics.js');

let currentJobSnapshot: SyncJob;

function createLogger(): AppLogger {
  const logger: any = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn()
  } as unknown as AppLogger;
  (logger.child as any).mockImplementation(() => logger);
  return logger;
}

function createJob(overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    id: 'job-1',
    pairId: 'pair-1',
    connectorId: 'conn-1',
    windowStart: new Date('2025-01-01T00:00:00Z'),
    windowEnd: new Date('2025-01-01T01:00:00Z'),
    payload: {},
    status: 'pending',
    priority: 0,
    retryCount: 0,
    maxRetries: 5,
    nextRunAt: new Date('2025-01-01T00:00:00Z'),
    lastError: null,
    idempotencyKey: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides
  } satisfies SyncJob;
}

function createPrismaMock() {
  const prisma: any = {};

  prisma.syncJob = {
    update: vi.fn(async ({ data }) => ({ ...currentJobSnapshot, ...data }))
  };

  prisma.syncJobLog = {
    create: vi.fn(async ({ data }) => data)
  };

  prisma.connectorFailureStat = {
    updateMany: vi.fn(async () => ({})),
    upsert: vi.fn(async ({ update, create }) => ({
      connectorId: 'conn-1',
      pairId: 'pair-1',
      consecutiveFailures: update?.consecutiveFailures?.increment
        ? update.consecutiveFailures.increment
        : create?.consecutiveFailures ?? 0,
      lastFailureAt: update?.lastFailureAt ?? create?.lastFailureAt ?? null,
      pausedUntil: null
    })),
    update: vi.fn(async () => ({})),
    findUnique: vi.fn(async () => null)
  };

  prisma.alert = {
    updateMany: vi.fn(async () => ({})),
    findFirst: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
    create: vi.fn(async ({ data }) => data)
  };

  prisma.$queryRaw = vi.fn(async () => []);
  prisma.$transaction = vi.fn(async (callback) =>
    callback({
      syncJob: prisma.syncJob,
      syncJobLog: prisma.syncJobLog,
      connectorFailureStat: prisma.connectorFailureStat,
      alert: prisma.alert
    })
  );

  return prisma;
}

beforeEach(() => {
  currentJobSnapshot = createJob();
  vi.clearAllMocks();
});

describe('QueueConsumer processJob', () => {
  it('marks jobs completed and resets failure stats on success', async () => {
    const prisma = createPrismaMock();
    const logger = createLogger();
    const executor = vi.fn(async () => ({
      outcome: 'success' as const,
      processedEvents: 10,
      failedEvents: 0
    }));

    const consumer = new QueueConsumer({
      prisma,
      logger,
      executor,
      pollIntervalMs: 1000,
      random: () => 0
    } as any);

    await (consumer as any).processJob(currentJobSnapshot);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed', lastError: null })
      })
    );
    expect(prisma.connectorFailureStat.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ consecutiveFailures: 0 })
      })
    );
    expect(metrics.recordJobStatus).toHaveBeenCalledWith('completed', 'conn-1');
    expect(metrics.observeJobDuration).toHaveBeenCalledWith('success', expect.any(Number));
  });

  it('moves job to retrying state with backoff and records retry metrics', async () => {
    const prisma = createPrismaMock();
    const logger = createLogger();
    const executor = vi.fn(async () => ({
      outcome: 'failure' as const,
      processedEvents: 3,
      failedEvents: 1,
      errorSummary: 'network down'
    }));

    const job = createJob({ retryCount: 0 });
    currentJobSnapshot = job;

    const consumer = new QueueConsumer({
      prisma,
      logger,
      executor,
      pollIntervalMs: 1000,
      random: () => 0
    } as any);

    await (consumer as any).processJob(job);

    expect(prisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: job.id },
        data: expect.objectContaining({
          status: 'retrying',
          retryCount: 1,
          lastError: 'network down'
        })
      })
    );
    const updateArgs = prisma.syncJob.update.mock.calls.at(-1)?.[0];
    const expectedNextRun = calculateNextRunAt(1, job.nextRunAt, { random: () => 0 });
    expect(updateArgs.data.nextRunAt.getTime()).toBeGreaterThan(job.nextRunAt.getTime());
    expect(metrics.recordRetry).toHaveBeenCalledWith('conn-1');
    expect(metrics.recordJobStatus).toHaveBeenCalledWith('retrying', 'conn-1');
  });

  it('marks job failed and trips circuit breaker after exhausting retries', async () => {
    const prisma = createPrismaMock();
    const logger = createLogger();

    prisma.connectorFailureStat.upsert = vi.fn(async () => ({
      connectorId: 'conn-1',
      pairId: 'pair-1',
      consecutiveFailures: 5,
      lastFailureAt: new Date(),
      pausedUntil: null
    }));

    const alertCreate = prisma.alert.create;

    const executor = vi.fn(async () => {
      throw new Error('fatal error');
    });

    const job = createJob({ retryCount: 4 });
    currentJobSnapshot = job;

    const consumer = new QueueConsumer({
      prisma,
      logger,
      executor,
      pollIntervalMs: 1000,
      random: () => 0
    } as any);

    await (consumer as any).processJob(job);

    expect(prisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', retryCount: 5 })
      })
    );
    expect(prisma.connectorFailureStat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pausedUntil: expect.any(Date) })
      })
    );
    expect(alertCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: 'sync_circuit_breaker' })
      })
    );
    expect(metrics.recordJobStatus).toHaveBeenCalledWith('failed', 'conn-1');
  });
});
