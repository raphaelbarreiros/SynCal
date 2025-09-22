import { ZodError } from 'zod';
import type { FastifyInstance } from 'fastify';
import { maskEmail } from '../../lib/mask.js';
import { setAdminSession, destroyAdminSession } from '../../lib/session.js';
import { authenticateAdmin, parseLoginRequest } from '../../services/auth.js';

export async function sessionRoutes(fastify: FastifyInstance): Promise<void> {
  const maxLoginAttempts = fastify.appConfig.AUTH_SESSION_RATE_LIMIT_MAX;

  fastify.post(
    '/auth/session',
    {
      config: {
        rateLimit: {
          max: maxLoginAttempts,
          timeWindow: '1 minute'
        }
      },
      preHandler: [fastify.csrfProtection]
    },
    async function (request, reply) {
      request.log.info({
        headers: request.headers,
        hasSession: Boolean((request.session as any)?._csrf),
        csrfToken: request.headers['x-csrf-token'] || request.headers['csrf-token']
      }, 'login request metadata');
      try {
        const credentials = parseLoginRequest(request.body);
        const result = await authenticateAdmin(fastify.repos.adminUsers, credentials);

        if (!result) {
          fastify.log.warn(
            {
              event: 'admin_login_failed',
              email: maskEmail(credentials.email)
            },
            'Invalid administrator login attempt'
          );
          return reply.status(401).send();
        }

        setAdminSession(request, result.admin.id, result.admin.email);
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.status(400).send({ error: 'Invalid login payload' });
        }

        request.log.error({ err: error }, 'Failed to create admin session');
        throw error;
      }
    }
  );

  fastify.delete(
    '/auth/session',
    {
      onRequest: [fastify.requireAdmin],
      preHandler: [fastify.csrfProtection]
    },
    async function (request, reply) {
      await destroyAdminSession(request);
      return reply.status(204).send();
    }
  );

  fastify.get(
    '/auth/session',
    {
      onRequest: [fastify.requireAdmin]
    },
    async function (request, reply) {
      return reply.status(200).send({ admin: request.admin });
    }
  );

  fastify.get('/auth/csrf', async function (_request, reply) {
    const token = await reply.generateCsrf();
    return reply.status(200).send({ token });
  });
}
