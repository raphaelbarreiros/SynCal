import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import {
  createConnector,
  handleOAuthCallback,
  listOAuthContext,
  startOAuthFlow
} from '../../services/connectors.js';

function buildRedirectUrl(base: string, provider: string, state: string | undefined, status: string) {
  const url = new URL('/connectors', base);
  url.searchParams.set('provider', provider);
  if (state) {
    url.searchParams.set('state', state);
  }
  url.searchParams.set('status', status);
  return url.toString();
}

export async function oauthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/auth/oauth/start',
    {
      onRequest: [fastify.requireAdmin],
      preHandler: [fastify.csrfProtection]
    },
    async function (request, reply) {
      try {
        const result = startOAuthFlow(request.session, request.body, {
          env: fastify.appConfig,
          connectorRegistry: fastify.connectorRegistry,
          connectors: fastify.repos.connectors,
          calendars: fastify.repos.calendars,
          auditLogs: fastify.repos.auditLogs,
          prisma: fastify.prisma
        });

        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.status(400).send({ error: 'Invalid provider payload' });
        }

        request.log.error({ err: error }, 'Failed to start OAuth flow');
        return reply.status(500).send({ error: 'Failed to start OAuth flow' });
      }
    }
  );

  fastify.get(
    '/auth/oauth/context',
    {
      onRequest: [fastify.requireAdmin]
    },
    async function (request, reply) {
      const context = await listOAuthContext(request.session);
      return reply.status(200).send(context);
    }
  );

  fastify.get('/auth/google/callback', async function (request, reply) {
    const query = request.query;
    const state = typeof (query as any)?.state === 'string' ? (query as any).state : undefined;

    try {
      await handleOAuthCallback(request.session, 'google', query, {
        env: fastify.appConfig,
        connectorRegistry: fastify.connectorRegistry,
        connectors: fastify.repos.connectors,
        calendars: fastify.repos.calendars,
        auditLogs: fastify.repos.auditLogs,
        prisma: fastify.prisma
      });

      return reply.redirect(buildRedirectUrl(fastify.appConfig.APP_BASE_URL, 'google', state, 'success'));
    } catch (error) {
      request.log.error({ err: error }, 'Google OAuth callback failed');
      return reply.redirect(buildRedirectUrl(fastify.appConfig.APP_BASE_URL, 'google', state, 'error'));
    }
  });

  fastify.get('/auth/microsoft/callback', async function (request, reply) {
    const query = request.query;
    const state = typeof (query as any)?.state === 'string' ? (query as any).state : undefined;

    try {
      await handleOAuthCallback(request.session, 'microsoft', query, {
        env: fastify.appConfig,
        connectorRegistry: fastify.connectorRegistry,
        connectors: fastify.repos.connectors,
        calendars: fastify.repos.calendars,
        auditLogs: fastify.repos.auditLogs,
        prisma: fastify.prisma
      });

      return reply.redirect(buildRedirectUrl(fastify.appConfig.APP_BASE_URL, 'microsoft', state, 'success'));
    } catch (error) {
      request.log.error({ err: error }, 'Microsoft OAuth callback failed');
      return reply.redirect(buildRedirectUrl(fastify.appConfig.APP_BASE_URL, 'microsoft', state, 'error'));
    }
  });
}
