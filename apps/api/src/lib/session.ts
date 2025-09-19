import type { FastifyRequest } from 'fastify';
import type { Session } from '@fastify/session';

const ADMIN_SESSION_KEY = 'admin';

export interface AdminSession {
  id: string;
  email: string;
  issuedAt: string;
}

declare module '@fastify/session' {
  interface Session {
    [ADMIN_SESSION_KEY]?: AdminSession;
  }
}

export function setAdminSession(request: FastifyRequest, id: string, email: string): void {
  const issuedAt = new Date().toISOString();
  request.session[ADMIN_SESSION_KEY] = { id, email, issuedAt } satisfies AdminSession;
}

export function getAdminSession(request: FastifyRequest): AdminSession | null {
  const session = request.session[ADMIN_SESSION_KEY];
  if (!session) {
    return null;
  }

  return session;
}

export function touchAdminSession(request: FastifyRequest): void {
  const current = getAdminSession(request);
  if (!current) {
    return;
  }

  current.issuedAt = new Date().toISOString();
  request.session[ADMIN_SESSION_KEY] = current;
}

export async function destroyAdminSession(request: FastifyRequest): Promise<void> {
  await request.session.destroy();
}
