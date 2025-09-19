import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import type { FastifyInstance } from 'fastify';

export const SESSION_COOKIE_NAME = 'syn_session';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export default fp(async (fastify: FastifyInstance) => {
  const env = fastify.appConfig;

  if (!env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be configured before registering the session plugin');
  }

  await fastify.register(fastifyCookie);

  await fastify.register(fastifySession, {
    secret: env.SESSION_SECRET,
    cookieName: SESSION_COOKIE_NAME,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_TTL_MS
    },
    rolling: true,
    saveUninitialized: false
  });
});
