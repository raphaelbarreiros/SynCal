import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { createConnector, listConnectors } from '../../services/connectors.js';

const ConnectorIdParamSchema = z.object({
  connectorId: z.string().uuid()
});

export async function connectorRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/connectors',
    {
      onRequest: [fastify.requireAdmin]
    },
    async function (request, reply) {
      const connectors = await listConnectors(request.admin!.id, {
        env: fastify.appConfig,
        connectorRegistry: fastify.connectorRegistry,
        connectors: fastify.repos.connectors,
        calendars: fastify.repos.calendars,
        auditLogs: fastify.repos.auditLogs,
        prisma: fastify.prisma
      });

      return reply.status(200).send({ connectors });
    }
  );

  fastify.get(
    '/connectors/:connectorId',
    {
      onRequest: [fastify.requireAdmin]
    },
    async function (request, reply) {
      const params = ConnectorIdParamSchema.parse(request.params);
      const connectors = await listConnectors(request.admin!.id, {
        env: fastify.appConfig,
        connectorRegistry: fastify.connectorRegistry,
        connectors: fastify.repos.connectors,
        calendars: fastify.repos.calendars,
        auditLogs: fastify.repos.auditLogs,
        prisma: fastify.prisma
      });

      const connector = connectors.find((item) => item.id === params.connectorId);
      if (!connector) {
        return reply.status(404).send({ error: 'Connector not found' });
      }

      return reply.status(200).send(connector);
    }
  );

  fastify.post(
    '/connectors',
    {
      onRequest: [fastify.requireAdmin],
      preHandler: [fastify.csrfProtection]
    },
    async function (request, reply) {
      try {
        const connector = await createConnector({
          body: request.body,
          session: request.session,
          admin: request.admin!,
          deps: {
            env: fastify.appConfig,
            connectorRegistry: fastify.connectorRegistry,
            connectors: fastify.repos.connectors,
            calendars: fastify.repos.calendars,
            auditLogs: fastify.repos.auditLogs,
            prisma: fastify.prisma
          }
        });

        return reply.status(201).send(connector);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid connector payload' });
        }

        request.log.error({ err: error }, 'Failed to create connector');
        return reply.status(422).send({ error: 'Connector validation failed' });
      }
    }
  );
}
