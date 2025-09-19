import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { destroyAdminSession, getAdminSession, setAdminSession, touchAdminSession } from './session.js';

type MutableRequest = Pick<FastifyRequest, 'session'>;

function createRequest(): MutableRequest {
  const session: Record<string, unknown> & {
    destroy: ReturnType<typeof vi.fn>;
  } = {
    destroy: vi.fn().mockResolvedValue(undefined)
  };

  return {
    session: session as MutableRequest['session']
  };
}

describe('admin session helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it('stores and retrieves admin session state', () => {
    const request = createRequest();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z').getTime());

    setAdminSession(request as FastifyRequest, 'admin-id', 'admin@example.com');
    const session = getAdminSession(request as FastifyRequest);

    expect(session).not.toBeNull();
    expect(session?.id).toBe('admin-id');
    expect(session?.email).toBe('admin@example.com');
    expect(session?.issuedAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('refreshes issuedAt timestamp when touched', () => {
    const request = createRequest();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z').getTime());
    setAdminSession(request as FastifyRequest, 'admin-id', 'admin@example.com');
    const initialIssuedAt = getAdminSession(request as FastifyRequest)?.issuedAt;

    vi.advanceTimersByTime(1000);
    touchAdminSession(request as FastifyRequest);
    const refreshedIssuedAt = getAdminSession(request as FastifyRequest)?.issuedAt;

    expect(initialIssuedAt).not.toBeUndefined();
    expect(refreshedIssuedAt).not.toBeUndefined();
    expect(refreshedIssuedAt).not.toBe(initialIssuedAt);
  });

  it('destroys the session through Fastify utilities', async () => {
    const request = createRequest();

    await destroyAdminSession(request as FastifyRequest);

    expect((request.session as any).destroy).toHaveBeenCalledTimes(1);
  });
});
