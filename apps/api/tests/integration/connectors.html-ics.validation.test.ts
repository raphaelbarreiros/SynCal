import { describe, expect, it, vi } from 'vitest';
import type { ConnectorValidationResult } from '@syncal/core';
import { validateConnectorConfiguration } from '../../src/services/connector-validation.js';

describe('validateConnectorConfiguration – HTML/ICS integration', () => {
  it('returns preview data for a valid feed', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:int\nDTSTART:20260101T100000Z\nSUMMARY:Int Test\nEND:VEVENT\nEND:VCALENDAR',
        {
          status: 200,
          headers: {
            ETag: '"integration"'
          }
        }
      )
    );

    const result = await validateConnectorConfiguration(
      {
        type: 'html_ics',
        config: {
          feedUrl: 'https://calendar.example.com/int.ics',
          targetCalendarLabel: 'Integration'
        }
      },
      { fetch: fetchMock }
    );

    const typed: ConnectorValidationResult = result;
    expect(typed.status).toBe('ok');
    expect(typed.previewEvents).toHaveLength(1);
    expect(typed.maskedUrl).toBe('https://calendar.example.com/…/int.ics');
    expect(typed.cacheMetadata).toEqual({ etag: '"integration"' });
  });

  it('reports 401 responses as authentication issues', async () => {
    const fetchMock = vi.fn(async () => new Response('unauthorized', { status: 401 }));

    const result = await validateConnectorConfiguration(
      {
        type: 'html_ics',
        config: {
          feedUrl: 'https://calendar.example.com/private.ics',
          targetCalendarLabel: 'Private'
        }
      },
      { fetch: fetchMock }
    );

    expect(result.status).toBe('failed');
    expect(result.issues[0]?.code).toBe('HTTP_401');
    expect(result.issues[0]?.message).toContain('Authentication failed');
  });

  it('returns parse errors when feed payload is empty', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));

    const result = await validateConnectorConfiguration(
      {
        type: 'html_ics',
        config: {
          feedUrl: 'https://calendar.example.com/empty.ics',
          targetCalendarLabel: 'Empty'
        }
      },
      { fetch: fetchMock }
    );

    expect(result.status).toBe('failed');
    expect(result.issues[0]?.code).toBe('PARSE_ERROR');
  });
});
