import Fastify from 'fastify';
import { createLogger, loadEnv, registerConfig, type AppEnv } from '@syncal/config';
import prismaPlugin from './plugins/prisma.js';
import repositoriesPlugin from './plugins/repositories.js';
import sessionPlugin from './plugins/session.js';
import securityPlugin from './plugins/security.js';
import authGuardPlugin from './plugins/auth-guard.js';
import { runMigrations } from './lib/migrate.js';
import { ensureInitialAdmin } from './lib/bootstrap-admin.js';
import { healthRoutes } from './routes/health.js';
import { sessionRoutes } from './routes/auth/session.js';
import { oauthRoutes } from './routes/auth/oauth.js';
import { jobsScheduleRoutes } from './routes/jobs/schedule.js';
import connectorsPlugin from './plugins/connectors.js';
import { connectorRoutes } from './routes/connectors/index.js';

const logger = createLogger({ service: 'api' });

export async function buildServer(env: AppEnv) {
  const app = Fastify({
    logger: true
  });

  await registerConfig(app);
  await app.register(prismaPlugin);
  await app.register(repositoriesPlugin);
  await app.register(sessionPlugin);
  await app.register(securityPlugin);
  await app.register(authGuardPlugin);
  await app.register(connectorsPlugin);
  await app.register(healthRoutes);
  await app.register(sessionRoutes);
  await app.register(oauthRoutes);
  await app.register(jobsScheduleRoutes);
  await app.register(connectorRoutes);

  return app;
}

export async function start(): Promise<void> {
  const env = loadEnv();
  const app = await buildServer(env);

  try {
    await runMigrations(logger, env);
    await app.ready();
    await ensureInitialAdmin(app, env);
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
