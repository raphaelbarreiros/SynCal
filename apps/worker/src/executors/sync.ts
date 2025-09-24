import type { PrismaClient, SyncJob } from '@prisma/client';
import type { AppLogger } from '@syncal/config';
import type { SyncJobOutcome } from '@syncal/core';

export interface JobExecutionContext {
  prisma: PrismaClient;
  logger: AppLogger;
}

export interface JobExecutionResult {
  outcome: SyncJobOutcome;
  processedEvents: number;
  failedEvents: number;
  errorSummary?: string;
}

export type JobExecutor = (
  job: SyncJob,
  context: JobExecutionContext
) => Promise<JobExecutionResult>;

export function createNoopSyncExecutor(): JobExecutor {
  return async (job, context) => {
    context.logger.info(
      {
        event: 'sync_job_noop_executor',
        jobId: job.id,
        pairId: job.pairId,
        connectorId: job.connectorId
      },
      'Executing sync job with noop executor'
    );

    return {
      outcome: 'success',
      processedEvents: 0,
      failedEvents: 0
    } satisfies JobExecutionResult;
  };
}

export function createJobRouter(
  routes: Record<string, JobExecutor>,
  fallback?: JobExecutor
): JobExecutor {
  const fallbackExecutor =
    fallback ??
    (async (job, context) => {
      const payload = job.payload as Record<string, unknown> | null;
      const jobType = typeof payload?.type === 'string' ? payload.type : 'unknown';
      context.logger.error({ jobId: job.id, jobType, payload }, 'Unsupported job type');
      return {
        outcome: 'failure',
        processedEvents: 0,
        failedEvents: 0,
        errorSummary: `No executor registered for job type: ${jobType}`
      } satisfies JobExecutionResult;
    });

  return async (job, context) => {
    const payload = job.payload as Record<string, unknown> | null;
    const jobType = typeof payload?.type === 'string' ? payload.type : undefined;
    const executor = jobType ? routes[jobType] : undefined;

    if (!executor) {
      return fallbackExecutor(job, context);
    }

    return executor(job, context);
  };
}
