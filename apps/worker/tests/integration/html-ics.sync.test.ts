import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import type { AppLogger } from '@syncal/config';
import { encryptJson } from '@syncal/config';
import {
  HtmlIcsConnectorMetadataSchema,
  type HtmlIcsConnectorMetadata
} from '@syncal/core';
import { createHtmlIcsSyncExecutor } from '../../src/executors/html-ics.js';
import { QueueConsumer } from '../../src/consumers/queue.js';

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

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ?? 'base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';

let prisma: PrismaClient | null = null;
let schemaName = '';
let databaseUrl = '';
let databaseReady = true;

try {
  schemaName = `worker_html_ics_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
  console.warn('Skipping HTML/ICS worker integration tests: database not reachable.', error);
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
  calendarId: string;
  jobId: string;
}

async function seedHtmlIcsJob(): Promise<SeedResult> {
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

  const metadata = HtmlIcsConnectorMetadataSchema.parse({
    targetCalendarLabel: 'Ops Calendar',
    validationMetadata: {
      status: 'failed',
      maskedUrl: undefined,
      previewEvents: [],
      lastSuccessfulFetchAt: null,
      issues: []
    },
    fetchCache: undefined
  });

  const connector = await prisma.connector.create({
    data: {
      ownerId: admin.id,
      type: 'html_ics',
      displayName: 'HTML Feed',
      status: 'pending_validation',
      credentialsEncrypted: encryptJson({
        feedUrl: 'https://calendar.example.com/feed.ics',
        authHeader: null,
        authToken: null
      }),
      configJson: metadata as unknown as Prisma.JsonObject
    }
  });

  const calendar = await prisma.calendar.create({
    data: {
      connectorId: connector.id,
      providerCalendarId: 'https://calendar.example.com/feed.ics',
      displayName: 'Ops Calendar',
      privacyMode: 'original_title',
      metadata: { targetCalendarLabel: 'Ops Calendar' }
    }
  });

  const pair = await prisma.syncPair.create({
    data: {
      primaryCalendarId: calendar.id,
      secondaryCalendarId: calendar.id,
      fallbackOrder: [],
      active: true
    }
  });

  const job = await prisma.syncJob.create({
    data: {
      pairId: pair.id,
      connectorId: connector.id,
      windowStart: new Date('2025-01-01T00:00:00Z'),
      windowEnd: new Date('2025-01-01T02:00:00Z'),
      payload: {
        type: 'html_ics_sync',
        calendarId: calendar.id
      } as Prisma.JsonObject,
      status: 'pending',
      nextRunAt: new Date('2025-01-01T00:00:00Z'),
      priority: 1
    }
  });

  return {
    connectorId: connector.id,
    calendarId: calendar.id,
    jobId: job.id
  };
}

async function runJobOnce(consumer: QueueConsumer, jobId: string): Promise<void> {
  if (!prisma) {
    throw new Error('Database not initialised');
  }
  const job = await prisma.syncJob.findUniqueOrThrow({ where: { id: jobId } });
  // Access private method for deterministic execution in tests.
  // @ts-expect-error accessing private method in tests
  await consumer.processJob(job);
}

beforeEach(async () => {
  if (databaseReady) {
    await truncateAll();
  }
});

const describeIfReady = databaseReady ? describe : describe.skip;

describeIfReady('HTML/ICS worker executor integration', () => {
  it('marks connector as validated after successful fetch', async () => {
    const { jobId, connectorId } = await seedHtmlIcsJob();
    const fetchMock = vi.fn(async () =>
      new Response(
        'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:sync\nDTSTART:20260101T100000Z\nSUMMARY:Sync Event\nEND:VEVENT\nEND:VCALENDAR',
        {
          status: 200,
          headers: {
            ETag: '"etag-success"',
            'Last-Modified': 'Wed, 01 Jan 2025 00:00:00 GMT'
          }
        }
      )
    );

    const executor = createHtmlIcsSyncExecutor({ fetch: fetchMock, now: () => new Date('2025-01-02T00:00:00Z') });
    const consumer = new QueueConsumer({
      prisma: prisma!,
      logger: createLogger(),
      executor,
      pollIntervalMs: 50,
      random: () => 0
    });

    await runJobOnce(consumer, jobId);

    const connector = await prisma!.connector.findUniqueOrThrow({ where: { id: connectorId } });
    const config = HtmlIcsConnectorMetadataSchema.parse(connector.configJson);

    expect(connector.status).toBe('validated');
    expect(connector.lastSuccessfulFetchAt).not.toBeNull();
    expect(config.validationMetadata.status).toBe('ok');
    expect(config.validationMetadata.previewEvents).toHaveLength(1);
    expect(config.fetchCache).toEqual({
      etag: '"etag-success"',
      lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT'
    });

    const job = await prisma!.syncJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe('completed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on timeout failures and updates validation issues', async () => {
    const { jobId, connectorId } = await seedHtmlIcsJob();
    const fetchMock = vi.fn(async () => {
      const error = new Error('Abort');
      error.name = 'AbortError';
      throw error;
    });

    const executor = createHtmlIcsSyncExecutor({ fetch: fetchMock, now: () => new Date('2025-01-02T00:00:00Z') });
    const consumer = new QueueConsumer({
      prisma: prisma!,
      logger: createLogger(),
      executor,
      pollIntervalMs: 50,
      random: () => 0
    });

    await runJobOnce(consumer, jobId);

    const job = await prisma!.syncJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe('retrying');
    expect(job.retryCount).toBe(1);
    expect(job.nextRunAt.getTime()).toBeGreaterThan(new Date('2025-01-02T00:00:00Z').getTime());

    const connector = await prisma!.connector.findUniqueOrThrow({ where: { id: connectorId } });
    const config = HtmlIcsConnectorMetadataSchema.parse(connector.configJson);

    expect(connector.status).toBe('pending_validation');
    expect(config.validationMetadata.issues[0]?.code).toBe('TIMEOUT');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('pauses connector after repeated failures', async () => {
    const { jobId, connectorId } = await seedHtmlIcsJob();
    const fetchMock = vi.fn(async () => new Response('error', { status: 500 }));

    const executor = createHtmlIcsSyncExecutor({ fetch: fetchMock, now: () => new Date('2025-01-02T00:00:00Z') });
    const consumer = new QueueConsumer({
      prisma: prisma!,
      logger: createLogger(),
      executor,
      pollIntervalMs: 10,
      random: () => 0
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      await runJobOnce(consumer, jobId);
      const job = await prisma!.syncJob.findUniqueOrThrow({ where: { id: jobId } });
      if (job.status === 'failed') {
        break;
      }
      await prisma!.syncJob.update({
        where: { id: jobId },
        data: {
          nextRunAt: new Date('2025-01-02T00:00:00Z')
        }
      });
    }

    const failureStat = await prisma!.connectorFailureStat.findUnique({
      where: {
        connectorId_pairId: {
          connectorId,
          pairId: (await prisma!.syncJob.findUniqueOrThrow({ where: { id: jobId } })).pairId
        }
      }
    });

    expect(failureStat?.consecutiveFailures).toBeGreaterThanOrEqual(5);
    expect(failureStat?.pausedUntil).not.toBeNull();

    const alerts = await prisma!.alert.findMany({
      where: { connectorId },
      orderBy: { createdAt: 'desc' }
    });
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]?.category).toBe('sync_circuit_breaker');
  });
});
