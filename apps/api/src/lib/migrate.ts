import { spawn } from 'node:child_process';
import { once } from 'node:events';
import type { AppEnv, AppLogger } from '@syncal/config';

export async function runMigrations(logger: AppLogger, env: AppEnv): Promise<void> {
  logger.info('Applying database migrations');

  const child = spawn('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: env.DATABASE_URL
    }
  });

  const [code] = (await once(child, 'exit')) as [number | null];

  if (code !== 0) {
    throw new Error('Prisma migrate deploy failed');
  }

  logger.info('Database migrations completed');
}
