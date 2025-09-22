import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGoogleAdapter } from './google.js';

const adapter = createGoogleAdapter();
const originalFetch = global.fetch;

declare global {
  // eslint-disable-next-line no-var
  var fetch: typeof globalThis.fetch;
}

function mockFetch(response: unknown, init?: { ok?: boolean; status?: number }) {
  return vi
    .fn()
    .mockResolvedValue({
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      text: async () => JSON.stringify(response)
    });
}

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('google adapter', () => {
  it('normalizes calendar list results', async () => {
    const calendars = [
      {
        id: 'primary',
        summary: 'Primary',
        description: 'Main calendar',
        timeZone: 'UTC',
        primary: true,
        accessRole: 'owner'
      }
    ];

    global.fetch = mockFetch({ items: calendars });

    const result = await adapter.listCalendars({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
      scope: 'calendar',
      tokenType: 'Bearer',
      obtainedAt: new Date().toISOString(),
      raw: {}
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'primary',
        name: 'Primary',
        isPrimary: true,
        canEdit: true
      })
    );
  });

  it('summarizes upcoming events window', async () => {
    global.fetch = mockFetch({ items: [{ id: 'evt-1' }, { id: 'evt-2' }] });

    const summary = await adapter.fetchUpcomingEvents(
      {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 3600,
        scope: 'calendar',
        tokenType: 'Bearer',
        obtainedAt: new Date().toISOString(),
        raw: {}
      },
      'calendar-123'
    );

    expect(summary.calendarId).toBe('calendar-123');
    expect(summary.total).toBe(2);
    expect(new Date(summary.from).getTime()).toBeLessThan(new Date(summary.to).getTime());
  });
});
