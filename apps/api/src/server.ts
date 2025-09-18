import Fastify from 'fastify';
import { createLogger, loadEnv, registerConfig, type AppEnv } from '@syncal/config';
import prismaPlugin from './plugins/prisma.js';
import { runMigrations } from './lib/migrate.js';
import { healthRoutes } from './routes/health.js';

const logger = createLogger({ service: 'api' });

export async function buildServer(env: AppEnv) {
  const app = Fastify({
    logger: true
  });

  await registerConfig(app);
  await app.register(prismaPlugin);
  await app.register(healthRoutes);

  return app;
}

export async function start(): Promise<void> {
  const env = loadEnv();
  const app = await buildServer(env);

  try {
    await runMigrations(logger, env);
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info({ port: env.PORT }, 'API listening');
  } catch (err) {
    logger.error({ err }, 'Failed to start API');
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  start();
}
