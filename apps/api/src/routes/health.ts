import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@syncal/core';

const HEALTHY_RESPONSE: Omit<HealthResponse, 'time'> = {
  status: 'ok',
  db: 'connected',
  encryptionKey: 'ready'
};

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async (_request, reply) => {
    const result: HealthResponse = {
      ...HEALTHY_RESPONSE,
      time: new Date().toISOString()
    };

    const issues: string[] = [];

    try {
      await app.prisma.$queryRawUnsafe('SELECT 1');
    } catch (error) {
      result.status = 'degraded';
      result.db = 'disconnected';
      issues.push('database');
      app.log.error({ error }, 'Database health check failed');
    }

    if (!app.appConfig.ENCRYPTION_KEY) {
      result.status = 'degraded';
      result.encryptionKey = 'missing';
      issues.push('encryption');
      app.log.error('Encryption key missing');
    }

    if (result.status === 'ok') {
      return result;
    }

    return reply.status(503).send({
      ...result,
      reason: issues.join(', ')
    });
  });
}
