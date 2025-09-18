import { PrismaClient } from '@prisma/client';
import { createLogger, loadEnv } from '@syncal/config';
import { createWorker } from './worker.js';

const env = loadEnv();
const logger = createLogger({ service: 'worker' });

export async function startWorker(): Promise<void> {
  const worker = createWorker({
    prisma: new PrismaClient(),
    logger,
    intervalMs: env.WORKER_HEARTBEAT_INTERVAL_MS
  });

  await worker.start();
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  startWorker().catch((error) => {
    logger.error({ error }, 'Worker failed to start');
    process.exit(1);
  });
}
