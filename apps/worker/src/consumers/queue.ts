import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, type PrismaClient, type SyncJob } from '@prisma/client';
import type { AppLogger } from '@syncal/config';
import { calculateNextRunAt, type SyncJobOutcome, type SyncJobStatus } from '@syncal/core';
import {
  observeJobDuration,
  recordJobStatus,
  recordRetry,
  refreshQueueDepth
} from '../telemetry/metrics.js';
import type { JobExecutionResult, JobExecutor } from '../executors/sync.js';

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_PAUSE_MS = 30 * 60_000;

const CLAIMABLE_STATUSES: SyncJobStatus[] = ['pending', 'retrying'];
const CLAIMABLE_STATUS_SQL = Prisma.join(
  CLAIMABLE_STATUSES.map((status) => Prisma.sql`${status}::"SyncJobStatus"`)
);

interface FailureResult {
  outcome: SyncJobOutcome;
  processedEvents: number;
  failedEvents: number;
  errorSummary: string;
}

export interface QueueConsumerOptions {
  prisma: PrismaClient;
  logger: AppLogger;
  executor: JobExecutor;
  pollIntervalMs: number;
  random?: () => number;
}

export class QueueConsumer {
  private readonly prisma: PrismaClient;
  private readonly logger: AppLogger;
  private readonly executor: JobExecutor;
  private readonly pollIntervalMs: number;
  private readonly random: () => number;

  private timer: NodeJS.Timeout | null = null;
  private active = false;
  private processing = false;

  constructor(options: QueueConsumerOptions) {
    this.prisma = options.prisma;
    this.logger = options.logger;
    this.executor = options.executor;
    this.pollIntervalMs = options.pollIntervalMs;
    this.random = options.random ?? Math.random;
  }

  async start(): Promise<void> {
    if (this.active) {
      return;
    }

    this.active = true;
    await refreshQueueDepth(this.prisma).catch((error) => {
      this.logger.warn({ err: error }, 'Failed to refresh queue depth at startup');
    });

    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    while (this.processing) {
      await delay(25);
    }
  }

  private async tick(): Promise<void> {
    if (!this.active || this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.active) {
        const job = await this.claimNextJob();
        if (!job) {
          break;
        }

        await this.processJob(job);
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Worker tick failed');
    } finally {
      this.processing = false;
    }
  }

  private async claimNextJob(): Promise<SyncJob | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT j.id
            FROM "sync_jobs" j
            WHERE j.status IN (${CLAIMABLE_STATUS_SQL})
              AND j.next_run_at <= NOW()
              AND NOT EXISTS (
                SELECT 1
                FROM "connector_failure_stats" cfs
                WHERE cfs.connector_id = j.connector_id
                  AND cfs.pair_id = j.pair_id
                  AND cfs.paused_until IS NOT NULL
                  AND cfs.paused_until > NOW()
              )
            ORDER BY j.priority DESC, j.next_run_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          `
        );

        if (rows.length === 0) {
          return null;
        }

        const [row] = rows;
        return tx.syncJob.update({
          where: { id: row.id },
          data: { status: 'in_progress' }
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  }

  private async processJob(job: SyncJob): Promise<void> {
    const jobLogger = this.logger.child({
      jobId: job.id,
      pairId: job.pairId,
      connectorId: job.connectorId
    });

    await refreshQueueDepth(this.prisma).catch((error) => {
      jobLogger.warn({ err: error }, 'Failed to refresh queue depth after claim');
    });

    const startedAt = new Date();
    let result: JobExecutionResult | FailureResult;

    try {
      result = await this.executor(job, { prisma: this.prisma, logger: jobLogger });
      if (result.outcome === 'failure') {
        result = {
          outcome: 'failure',
          processedEvents: result.processedEvents,
          failedEvents: result.failedEvents,
          errorSummary: result.errorSummary ?? 'Job executor reported failure'
        } satisfies FailureResult;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      jobLogger.error({ err }, 'Job executor threw an error');
      result = {
        outcome: 'failure',
        processedEvents: 0,
        failedEvents: 0,
        errorSummary: err.message
      } satisfies FailureResult;
    }

    const finishedAt = new Date();
    const durationSeconds = (finishedAt.getTime() - startedAt.getTime()) / 1000;
    observeJobDuration(result.outcome, durationSeconds);

    if (result.outcome === 'success' || result.outcome === 'partial') {
      await this.finalizeSuccess(job, result, startedAt, finishedAt, jobLogger);
      return;
    }

    await this.finalizeFailure(job, result as FailureResult, startedAt, finishedAt, jobLogger);
  }

  private async finalizeSuccess(
    job: SyncJob,
    result: JobExecutionResult,
    startedAt: Date,
    finishedAt: Date,
    jobLogger: AppLogger
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.syncJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          lastError: null,
          updatedAt: finishedAt
        }
      });

      await tx.syncJobLog.create({
        data: {
          jobId: job.id,
          pairId: job.pairId,
          connectorId: job.connectorId,
          startedAt,
          finishedAt,
          processedEvents: result.processedEvents,
          failedEvents: result.failedEvents,
          outcome: result.outcome,
          errorSummary: result.errorSummary ?? null
        }
      });

      await tx.connectorFailureStat.updateMany({
        where: {
          connectorId: job.connectorId,
          pairId: job.pairId
        },
        data: {
          consecutiveFailures: 0,
          lastFailureAt: null,
          pausedUntil: null
        }
      });

      await tx.alert.updateMany({
        where: {
          category: 'sync_circuit_breaker',
          connectorId: job.connectorId,
          pairId: job.pairId,
          acknowledged: false
        },
        data: {
          acknowledged: true,
          message: 'Circuit breaker cleared after successful sync job'
        }
      });
    });

    recordJobStatus('completed', job.connectorId);
    await refreshQueueDepth(this.prisma).catch((error) => {
      jobLogger.warn({ err: error }, 'Failed to refresh queue depth after completion');
    });
    jobLogger.info('Job completed successfully');
  }

  private async finalizeFailure(
    job: SyncJob,
    result: FailureResult,
    startedAt: Date,
    finishedAt: Date,
    jobLogger: AppLogger
  ): Promise<void> {
    const newRetryCount = job.retryCount + 1;
    const reachedMax = newRetryCount >= job.maxRetries;
    const nextRunAt = reachedMax
      ? job.nextRunAt
      : calculateNextRunAt(newRetryCount, finishedAt, { random: this.random });
    const status: SyncJobStatus = reachedMax ? 'failed' : 'retrying';

    await this.prisma.$transaction(async (tx) => {
      await tx.syncJob.update({
        where: { id: job.id },
        data: {
          status,
          retryCount: newRetryCount,
          nextRunAt,
          lastError: result.errorSummary,
          updatedAt: finishedAt
        }
      });

      await tx.syncJobLog.create({
        data: {
          jobId: job.id,
          pairId: job.pairId,
          connectorId: job.connectorId,
          startedAt,
          finishedAt,
          processedEvents: result.processedEvents,
          failedEvents: result.failedEvents,
          outcome: 'failure',
          errorSummary: result.errorSummary
        }
      });

      let failureStats = await tx.connectorFailureStat.upsert({
        where: {
          connectorId_pairId: {
            connectorId: job.connectorId,
            pairId: job.pairId
          }
        },
        update: {
          consecutiveFailures: { increment: 1 },
          lastFailureAt: finishedAt
        },
        create: {
          connectorId: job.connectorId,
          pairId: job.pairId,
          consecutiveFailures: 1,
          lastFailureAt: finishedAt
        }
      });

      if (failureStats.consecutiveFailures < newRetryCount) {
        failureStats = await tx.connectorFailureStat.update({
          where: {
            connectorId_pairId: {
              connectorId: job.connectorId,
              pairId: job.pairId
            }
          },
          data: {
            consecutiveFailures: newRetryCount,
            lastFailureAt: finishedAt
          }
        });
      }

      if (
        failureStats.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD &&
        (!failureStats.pausedUntil || failureStats.pausedUntil <= finishedAt)
      ) {
        const pausedUntil = new Date(finishedAt.getTime() + CIRCUIT_BREAKER_PAUSE_MS);
        await tx.connectorFailureStat.update({
          where: {
            connectorId_pairId: {
              connectorId: job.connectorId,
              pairId: job.pairId
            }
          },
          data: {
            pausedUntil
          }
        });

        const alert = await tx.alert.findFirst({
          where: {
            category: 'sync_circuit_breaker',
            connectorId: job.connectorId,
            pairId: job.pairId,
            acknowledged: false
          }
        });

        const alertMessage = `Circuit breaker triggered for connector ${job.connectorId} / pair ${job.pairId} after ${failureStats.consecutiveFailures} failures`;

        if (alert) {
          await tx.alert.update({
            where: { id: alert.id },
            data: {
              message: alertMessage,
              acknowledged: false
            }
          });
        } else {
          await tx.alert.create({
            data: {
              category: 'sync_circuit_breaker',
              severity: 'warning',
              connectorId: job.connectorId,
              pairId: job.pairId,
              message: alertMessage
            }
          });
        }

        jobLogger.warn(
          {
            pausedUntil: pausedUntil.toISOString(),
            consecutiveFailures: failureStats.consecutiveFailures
          },
          'Circuit breaker activated for connector/pair'
        );
      }
    });

    recordJobStatus(status, job.connectorId);
    if (!reachedMax) {
      recordRetry(job.connectorId);
    }

    await refreshQueueDepth(this.prisma).catch((error) => {
      jobLogger.warn({ err: error }, 'Failed to refresh queue depth after failure');
    });

    if (reachedMax) {
      jobLogger.error(
        {
          retryCount: newRetryCount,
          error: result.errorSummary
        },
        'Job failed after exhausting retries'
      );
    } else {
      jobLogger.warn(
        {
          retryCount: newRetryCount,
          nextRunAt: nextRunAt.toISOString(),
          error: result.errorSummary
        },
        'Job scheduled for retry after failure'
      );
    }
  }
}
