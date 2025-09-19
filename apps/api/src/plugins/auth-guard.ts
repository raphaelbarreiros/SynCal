import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAdminSession, touchAdminSession, type AdminSession } from '../lib/session.js';

declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminSession;
  }

  interface FastifyInstance {
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = getAdminSession(request);

    if (!session) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    request.admin = session;
    touchAdminSession(request);
  });
});
