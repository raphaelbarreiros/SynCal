import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import csrfProtection from '@fastify/csrf-protection';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  const env = fastify.appConfig;

  await fastify.register(cors, {
    origin: env.CORS_ALLOWED_ORIGIN ?? true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS']
  });

  await fastify.register(csrfProtection, {
    sessionPlugin: '@fastify/session',
    cookieOpts: {
      path: '/',
      sameSite: 'lax',
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
