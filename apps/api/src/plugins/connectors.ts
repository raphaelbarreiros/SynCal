import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import {
  createConnectorRegistry,
  type ConnectorRegistry
} from '@syncal/connectors';

declare module 'fastify' {
  interface FastifyInstance {
    connectorRegistry: ConnectorRegistry;
  }
}

export default fp(async function connectorsPlugin(fastify: FastifyInstance) {
  const env = fastify.appConfig;

  const registry = createConnectorRegistry({
    microsoft: { tenantId: env.MS_TENANT_ID }
  });

  fastify.decorate('connectorRegistry', registry);
});
