import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { AdminUserRepository, AuditLogRepository, type Repositories } from '../repositories/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    repos: Repositories;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (fastify.hasDecorator('repos')) {
    fastify.log.debug('Repositories already registered; skipping default instantiation');
    return;
  }

  const repos: Repositories = {
    adminUsers: new AdminUserRepository(fastify.prisma),
    auditLogs: new AuditLogRepository(fastify.prisma)
  };

  fastify.decorate('repos', repos);
});
