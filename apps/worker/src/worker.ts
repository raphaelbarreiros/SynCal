import type { PrismaClient } from '@prisma/client';
import type { AppLogger } from '@syncal/config';
import { QueueConsumer, type QueueConsumerOptions } from './consumers/queue.js';
import { createNoopSyncExecutor, type JobExecutor } from './executors/sync.js';

type HeartbeatReason = 'startup' | 'interval';

type SignalHandler = (signal: NodeJS.Signals) => Promise<void> | void;

export interface WorkerOptions {
  prisma: PrismaClient;
  logger: AppLogger;
  intervalMs: number;
  pollIntervalMs?: number;
  executor?: JobExecutor;
  random?: () => number;
  exit?: (code: number) => never;
}

export interface WorkerController {
  start(): Promise<void>;
}

function emitHeartbeat(logger: AppLogger, reason: HeartbeatReason): void {
  logger.info({ reason }, 'Worker heartbeat');
}

function registerShutdown(handler: SignalHandler): void {
  process.once('SIGINT', handler);
  process.once('SIGTERM', handler);
}

export function createWorker(options: WorkerOptions): WorkerController {
  const { prisma, logger, intervalMs, pollIntervalMs = intervalMs, random, exit = process.exit } = options;
  const executor = options.executor ?? createNoopSyncExecutor();
  const queueLogger = logger.child({ component: 'queue_consumer' });
  const consumerOptions: QueueConsumerOptions = {
    prisma,
    logger: queueLogger,
    executor,
    pollIntervalMs,
    random
  };
  const consumer = new QueueConsumer(consumerOptions);

  return {
    async start() {
      await prisma.$connect();
      logger.info('Worker connected to database');

      emitHeartbeat(logger, 'startup');

      await consumer.start();

      const heartbeatInterval = setInterval(() => emitHeartbeat(logger, 'interval'), intervalMs);

      registerShutdown(async (signal) => {
        logger.info({ signal }, 'Shutting down worker');
        clearInterval(heartbeatInterval);
        await consumer.stop();
        await prisma.$disconnect();
        exit(0);
      });
    }
  };
}
