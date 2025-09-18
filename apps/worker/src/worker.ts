import type { PrismaClient } from '@prisma/client';
import type { AppLogger } from '@syncal/config';

type HeartbeatReason = 'startup' | 'interval';

type SignalHandler = (signal: NodeJS.Signals) => Promise<void> | void;

export interface WorkerOptions {
  prisma: Pick<PrismaClient, '$connect' | '$disconnect'>;
  logger: AppLogger;
  intervalMs: number;
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
  const { prisma, logger, intervalMs, exit = process.exit } = options;

  return {
    async start() {
      await prisma.$connect();
      logger.info('Worker connected to database');

      emitHeartbeat(logger, 'startup');

      const interval = setInterval(() => emitHeartbeat(logger, 'interval'), intervalMs);

      registerShutdown(async (signal) => {
        logger.info({ signal }, 'Shutting down worker');
        clearInterval(interval);
        await prisma.$disconnect();
        exit(0);
      });
    }
  };
}
