import { PrismaClient } from '@prisma/client';
import { createLogger, loadEnv } from '@syncal/config';
import { createConnectorRegistry } from '@syncal/connectors';
import { createWorker } from './worker.js';
import { createHtmlIcsSyncExecutor } from './executors/html-ics.js';
import { createConnectorValidationExecutor } from './executors/connector-validation.js';
import { createJobRouter } from './executors/sync.js';

const env = loadEnv();
const logger = createLogger({ service: 'worker' });

export async function startWorker(): Promise<void> {
  const registry = createConnectorRegistry({
    microsoft: { tenantId: env.MS_TENANT_ID }
  });

  const worker = createWorker({
    prisma: new PrismaClient(),
    logger,
    intervalMs: env.WORKER_HEARTBEAT_INTERVAL_MS,
    pollIntervalMs: Math.max(1000, Math.floor(env.WORKER_HEARTBEAT_INTERVAL_MS / 2)),
    executor: createJobRouter({
      html_ics_sync: createHtmlIcsSyncExecutor({ timeoutMs: 30_000 }),
      connector_validation: createConnectorValidationExecutor({ registry })
    })
  });

  await worker.start();
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  startWorker().catch((error) => {
    logger.error({ error }, 'Worker failed to start');
    process.exit(1);
  });
}
