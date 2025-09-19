import fp from 'fastify-plugin';
import csrfProtection from '@fastify/csrf-protection';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  const env = fastify.appConfig;

  await fastify.register(csrfProtection, {
    sessionPlugin: '@fastify/session',
    cookieOpts: {
      path: '/',
      sameSite: 'strict',
      secure: env.NODE_ENV === 'production',
      httpOnly: false
    }
  });

  await fastify.register(rateLimit, {
    global: false,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true
    }
  });
});
