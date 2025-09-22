import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMicrosoftAdapter } from './microsoft.js';

declare global {
  // eslint-disable-next-line no-var
  var fetch: typeof globalThis.fetch;
}

const adapter = createMicrosoftAdapter({ tenantId: 'common' });
const originalFetch = global.fetch;

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

describe('microsoft adapter', () => {
  it('normalizes calendar entries', async () => {
    global.fetch = mockFetch({
      value: [
        {
          id: 'cal-1',
          name: 'Team Calendar',
          hexColor: '#FF0000',
          timeZone: 'UTC',
          isDefaultCalendar: true
        }
      ]
    });

    const calendars = await adapter.listCalendars({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresIn: 3600,
      scope: 'Calendars.ReadWrite',
      tokenType: 'Bearer',
      obtainedAt: new Date().toISOString(),
      raw: {}
    });

    expect(calendars).toHaveLength(1);
    expect(calendars[0]).toEqual(
      expect.objectContaining({ id: 'cal-1', name: 'Team Calendar', isPrimary: true })
    );
  });
});
