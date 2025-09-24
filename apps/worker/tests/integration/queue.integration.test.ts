import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, SyncJobStatus } from '@prisma/client';
import type { AppLogger } from '@syncal/config';
import { QueueConsumer } from '../../src/consumers/queue.js';
import { resetMetrics, metricsRegistry } from '../../src/telemetry/metrics.js';

const rawDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://syncal:syncalsecret@localhost:5432/syncal';

const parsedUrl = new URL(rawDatabaseUrl);
if (parsedUrl.hostname === 'localhost') {
  parsedUrl.hostname = '127.0.0.1';
}

const BASE_DATABASE_URL = parsedUrl.toString();

function withSchema(url: string, schema: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}schema=${schema}`;
}

function createLogger(): AppLogger {
  const logger: any = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => logger
  };

  return logger as AppLogger;
}

let prisma: PrismaClient | null = null;
let schemaName = '';
let databaseUrl = '';
let databaseReady = true;

try {
  schemaName = `worker_tests_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  databaseUrl = withSchema(BASE_DATABASE_URL, schemaName);

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PGOPTIONS: `-c search_path=${schemaName},public`
    }
  });

  prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl }
    }
  });
} catch (error) {
  console.warn('Skipping worker queue integration tests: database not reachable.', error);
  databaseReady = false;
}

afterAll(async () => {
  if (!databaseReady || !prisma) {
    return;
  }
  await prisma.$disconnect();
  const adminClient = new PrismaClient({
    datasources: {
      db: { url: BASE_DATABASE_URL }
    }
  });
  await adminClient.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await adminClient.$disconnect();
});

async function truncateAll(): Promise<void> {
  if (!prisma) {
    return;
  }
  await prisma.$transaction([
    prisma.alert.deleteMany(),
    prisma.connectorFailureStat.deleteMany(),
    prisma.syncJobLog.deleteMany(),
    prisma.syncJob.deleteMany(),
    prisma.syncPair.deleteMany(),
    prisma.calendar.deleteMany(),
    prisma.connector.deleteMany(),
    prisma.adminUser.deleteMany()
  ]);
}

interface SeedResult {
  connectorId: string;
  pairId: string;
}

async function seedBase(): Promise<SeedResult> {
  if (!prisma) {
    throw new Error('Database not initialised');
  }
  const admin = await prisma.adminUser.create({
    data: {
      email: `admin+${randomUUID()}@example.com`,
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  const connector = await prisma.connector.create({
    data: {
      ownerId: admin.id,
      type: 'google',
      displayName: 'Google Connector',
      status: 'validated',
      credentialsEncrypted: Buffer.from('secret'),
      configJson: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  const primaryCalendar = await prisma.calendar.create({
    data: {
      connectorId: connector.id,
      providerCalendarId: `primary-${randomUUID()}`,
      displayName: 'Primary',
      privacyMode: 'original_title',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  const secondaryCalendar = await prisma.calendar.create({
    data: {
      connectorId: connector.id,
      providerCalendarId: `secondary-${randomUUID()}`,
      displayName: 'Secondary',
      privacyMode: 'original_title',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  const pair = await prisma.syncPair.create({
    data: {
      primaryCalendarId: primaryCalendar.id,
      secondaryCalendarId: secondaryCalendar.id,
      fallbackOrder: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  return { connectorId: connector.id, pairId: pair.id };
}

beforeEach(async () => {
  resetMetrics();
  if (databaseReady) {
    await truncateAll();
  }
});

const describeIfReady = databaseReady ? describe : describe.skip;

describeIfReady('QueueConsumer integration', () => {
  it('allows only one worker to claim a job and completes successfully', async () => {
    const client = prisma!;
    const { connectorId, pairId } = await seedBase();
    await client.syncJob.create({
      data: {
        pairId,
        connectorId,
        windowStart: new Date('2025-01-01T00:00:00Z'),
        windowEnd: new Date('2025-01-01T01:00:00Z'),
        payload: {},
        priority: 1
      }
    });

    const prismaA = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const prismaB = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

    const executor = async () => ({
      outcome: 'success' as const,
      processedEvents: 5,
      failedEvents: 0
    });

    const consumerA = new QueueConsumer({
      prisma: prismaA,
      logger: createLogger(),
      executor,
      pollIntervalMs: 100,
      random: () => 0
    });

    const consumerB = new QueueConsumer({
      prisma: prismaB,
      logger: createLogger(),
      executor,
      pollIntervalMs: 100,
      random: () => 0
    });

    const [claimA, claimB] = await Promise.all([
      (consumerA as any).claimNextJob(),
      (consumerB as any).claimNextJob()
    ]);

    const claimedJob = claimA ?? claimB;
    expect(claimedJob).toBeTruthy();
    expect(claimA && claimB).toBeFalsy();

    if (claimedJob) {
      await (consumerA as any).processJob(claimedJob);
    }

    const job = await client.syncJob.findFirstOrThrow({ where: { pairId } });
    expect(job.status).toBe('completed');

    const logEntry = await client.syncJobLog.findFirst({ where: { jobId: job.id } });
    expect(logEntry).not.toBeNull();
    await prismaA.$disconnect();
    await prismaB.$disconnect();
  });

  it('transitions jobs to retrying state with backoff metadata on failure', async () => {
    const { connectorId, pairId } = await seedBase();
    const client = prisma!;
    const jobRecord = await client.syncJob.create({
      data: {
        pairId,
        connectorId,
        windowStart: new Date('2025-01-02T00:00:00Z'),
        windowEnd: new Date('2025-01-02T01:00:00Z'),
        payload: {},
        priority: 0
      }
    });

    const consumer = new QueueConsumer({
      prisma: client,
      logger: createLogger(),
      executor: async () => ({
        outcome: 'failure' as const,
        processedEvents: 1,
        failedEvents: 1,
        errorSummary: 'network timeout'
      }),
      pollIntervalMs: 100,
      random: () => 0
    });

    await (consumer as any).processJob(jobRecord);

    const job = await client.syncJob.findUniqueOrThrow({ where: { id: jobRecord.id } });
    expect(job.status).toBe('retrying');
    expect(job.retryCount).toBe(1);
    expect(job.lastError).toBe('network timeout');
    expect(job.nextRunAt.getTime()).toBeGreaterThan(jobRecord.nextRunAt.getTime());

    const logEntry = await client.syncJobLog.findFirstOrThrow({ where: { jobId: job.id } });
    expect(logEntry.failedEvents).toBe(1);
  });

  it('marks job failed and activates circuit breaker after max retries', async () => {
    const { connectorId, pairId } = await seedBase();
    const client = prisma!;
    const jobRecord = await client.syncJob.create({
      data: {
        pairId,
        connectorId,
        windowStart: new Date('2025-01-03T00:00:00Z'),
        windowEnd: new Date('2025-01-03T01:00:00Z'),
        payload: {},
        priority: 0,
        retryCount: 4
      }
    });

    const consumer = new QueueConsumer({
      prisma: client,
      logger: createLogger(),
      executor: async () => {
        throw new Error('fatal failure');
      },
      pollIntervalMs: 100,
      random: () => 0
    });

    await (consumer as any).processJob(jobRecord);

    const job = await client.syncJob.findUniqueOrThrow({ where: { id: jobRecord.id } });
    expect(job.status).toBe<'failed' | SyncJobStatus>('failed');
    expect(job.retryCount).toBe(5);

    const stats = await client.connectorFailureStat.findUniqueOrThrow({
      where: {
        connectorId_pairId: {
          connectorId,
          pairId
        }
      }
    });
    expect(stats.consecutiveFailures).toBeGreaterThanOrEqual(5);
    expect(stats.pausedUntil).not.toBeNull();

    const alert = await client.alert.findFirst({
      where: {
        connectorId,
        pairId,
        category: 'sync_circuit_breaker'
      }
    });
    expect(alert).not.toBeNull();
  });

  it('records metrics for lifecycle and retries', async () => {
    const { connectorId, pairId } = await seedBase();
    const client = prisma!;
    const jobRecord = await client.syncJob.create({
      data: {
        pairId,
        connectorId,
        windowStart: new Date('2025-01-04T00:00:00Z'),
        windowEnd: new Date('2025-01-04T01:00:00Z'),
        payload: {},
        priority: 0
      }
    });

    const consumer = new QueueConsumer({
      prisma: client,
      logger: createLogger(),
      executor: async () => ({
        outcome: 'success' as const,
        processedEvents: 2,
        failedEvents: 0
      }),
      pollIntervalMs: 100,
      random: () => 0
    });

    await (consumer as any).processJob(jobRecord);

    const metricsMap = await metricsRegistry.getMetricsAsJSON();
    const lifecycle = metricsMap.find((metric) => metric.name === 'sync_jobs_total');
    expect(lifecycle?.values.some((entry: any) => entry.labels.status === 'completed')).toBe(true);

    const queueDepth = metricsMap.find((metric) => metric.name === 'sync_jobs_queue_depth');
    expect(queueDepth?.values.every((entry: any) => entry.value === 0)).toBe(true);
  });
});
