import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { SyncJobOutcome, SyncJobStatus } from '@syncal/core';

export const metricsRegistry = new Registry();

const trackedStatuses: SyncJobStatus[] = ['pending', 'retrying', 'in_progress'];

export const jobLifecycleCounter = new Counter({
  name: 'sync_jobs_total',
  help: 'Total number of jobs processed grouped by resulting status and connector',
  labelNames: ['status', 'connector_id'] as const,
  registers: [metricsRegistry]
});

export const queueDepthGauge = new Gauge({
  name: 'sync_jobs_queue_depth',
  help: 'Current depth of the job queue segmented by status',
  labelNames: ['status'] as const,
  registers: [metricsRegistry]
});

export const jobDurationHistogram = new Histogram({
  name: 'sync_job_duration_seconds',
  help: 'Execution duration of jobs segmented by outcome',
  labelNames: ['outcome'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry]
});

export const jobRetriesCounter = new Counter({
  name: 'sync_job_retries_total',
  help: 'Number of job retries initiated per connector',
  labelNames: ['connector_id'] as const,
  registers: [metricsRegistry]
});

export function recordJobStatus(status: SyncJobStatus, connectorId: string): void {
  jobLifecycleCounter.inc({ status, connector_id: connectorId });
}

export function observeJobDuration(outcome: SyncJobOutcome, seconds: number): void {
  jobDurationHistogram.observe({ outcome }, seconds);
}

export function recordRetry(connectorId: string): void {
  jobRetriesCounter.inc({ connector_id: connectorId });
}

export async function refreshQueueDepth(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ status: SyncJobStatus; count: bigint }>>(
    Prisma.sql`SELECT status, COUNT(*)::bigint AS count FROM "sync_jobs" GROUP BY status`
  );

  const counts = new Map<SyncJobStatus, number>();
  for (const row of rows) {
    counts.set(row.status, Number(row.count));
  }

  for (const status of trackedStatuses) {
    const count = counts.get(status) ?? 0;
    queueDepthGauge.set({ status }, count);
  }
}

export function resetMetrics(): void {
  metricsRegistry.resetMetrics();
}
