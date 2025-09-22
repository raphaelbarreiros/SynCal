import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import {
  createGoogleAdapter,
  createMicrosoftAdapter,
  type ConnectorAdapter,
  type OAuthProvider
} from '@syncal/connectors';

export interface ConnectorRegistry {
  getAdapter(provider: OAuthProvider): ConnectorAdapter;
}

class InMemoryConnectorRegistry implements ConnectorRegistry {
  private readonly adapters: Record<OAuthProvider, ConnectorAdapter>;

  constructor(tenantId: string) {
    this.adapters = {
      google: createGoogleAdapter(),
      microsoft: createMicrosoftAdapter({ tenantId })
    };
  }

  getAdapter(provider: OAuthProvider): ConnectorAdapter {
    const adapter = this.adapters[provider];
    if (!adapter) {
      throw new Error(`Unsupported connector provider: ${provider}`);
    }

    return adapter;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    connectorRegistry: ConnectorRegistry;
  }
}

export default fp(async function connectorsPlugin(fastify: FastifyInstance) {
  const env = fastify.appConfig;
  fastify.decorate('connectorRegistry', new InMemoryConnectorRegistry(env.MS_TENANT_ID));
});
