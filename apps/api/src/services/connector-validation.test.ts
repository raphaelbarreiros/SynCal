import { describe, expect, it, vi } from 'vitest';
import { validateConnectorConfiguration } from './connector-validation.js';

const SAMPLE_FEED = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:abc123\nDTSTART:20260101T100000Z\nDTEND:20260101T110000Z\nSUMMARY:Team Meeting\nEND:VEVENT\nEND:VCALENDAR`;

describe('validateConnectorConfiguration', () => {
  it('returns preview events for a valid HTML/ICS feed', async () => {
    const fetchMock = vi.fn(async () => new Response(SAMPLE_FEED, { status: 200 }));

    const result = await validateConnectorConfiguration(
      {
        type: 'html_ics',
        config: {
          feedUrl: 'https://calendar.example.com/feed.ics',
          targetCalendarLabel: 'Ops Calendar'
        }
      },
      { fetch: fetchMock }
    );

    expect(result.status).toBe('ok');
    expect(result.previewEvents).toHaveLength(1);
    expect(result.previewEvents?.[0]).toMatchObject({
      uid: 'abc123',
      summary: 'Team Meeting'
    });
    expect(result.maskedUrl).toBe('https://calendar.example.com/…/feed.ics');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns failed status when feed responds with 401', async () => {
    const fetchMock = vi.fn(async () => new Response('unauthorized', { status: 401 }));

    const result = await validateConnectorConfiguration(
      {
        type: 'html_ics',
        config: {
          feedUrl: 'https://calendar.example.com/private.ics',
          targetCalendarLabel: 'Ops Calendar'
        }
      },
      { fetch: fetchMock }
    );

    expect(result.status).toBe('failed');
    expect(result.issues[0].code).toBe('HTTP_401');
  });

  it('treats abort errors as timeout issues', async () => {
    const fetchMock = vi.fn(async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    });

    const result = await validateConnectorConfiguration(
      {
        type: 'html_ics',
        config: {
          feedUrl: 'https://calendar.example.com/slow.ics',
          targetCalendarLabel: 'Ops Calendar'
        }
      },
      { fetch: fetchMock }
    );

    expect(result.status).toBe('failed');
    expect(result.issues[0].code).toBe('TIMEOUT');
  });
});
