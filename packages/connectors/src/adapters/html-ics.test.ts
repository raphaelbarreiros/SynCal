import { describe, expect, it, vi } from 'vitest';

import { createHtmlIcsAdapter } from './html-ics.js';

describe('createHtmlIcsAdapter', () => {
  const NOW = new Date('2025-12-31T00:00:00.000Z');

  it('validates a feed and returns upcoming events', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'BEGIN:VEVENT',
          'UID:event-1',
          'DTSTART:20260101T100000Z',
          'DTEND:20260101T110000Z',
          'SUMMARY:Team Meeting',
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\n'),
        {
          status: 200,
          headers: {
            ETag: '"123"',
            'Last-Modified': 'Wed, 01 Jan 2025 00:00:00 GMT'
          }
        }
      )
    );

    const adapter = createHtmlIcsAdapter({ fetch: fetchMock, now: () => NOW });
    const result = await adapter.validate({
      feedUrl: 'https://calendar.example.com/feed.ics',
      targetCalendarLabel: 'Ops'
    });

    expect(result.status).toBe('ok');
    expect(result.previewEvents).toHaveLength(1);
    expect(result.previewEvents?.[0]).toMatchObject({
      uid: 'event-1',
      summary: 'Team Meeting',
      startsAt: '2026-01-01T10:00:00.000Z',
      endsAt: '2026-01-01T11:00:00.000Z',
      allDay: false
    });
    expect(result.maskedUrl).toBe('https://calendar.example.com/…/feed.ics');
    expect(result.cacheMetadata).toEqual({
      etag: '"123"',
      lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT'
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes through authentication headers when provided', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' });
      return new Response(
        'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nDTSTART:20270101T000000Z\nEND:VEVENT\nEND:VCALENDAR',
        { status: 200 }
      );
    });

    const adapter = createHtmlIcsAdapter({ fetch: fetchMock, now: () => NOW });
    await adapter.validate({
      feedUrl: 'https://calendar.example.com/private.ics',
      authHeader: 'Authorization',
      authToken: 'Bearer secret',
      targetCalendarLabel: 'Private'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports authentication failures as HTTP errors', async () => {
    const fetchMock = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    const adapter = createHtmlIcsAdapter({ fetch: fetchMock, now: () => NOW });

    const result = await adapter.validate({
      feedUrl: 'https://calendar.example.com/private.ics',
      targetCalendarLabel: 'Ops'
    });

    expect(result.status).toBe('failed');
    expect(result.issues[0].code).toBe('HTTP_401');
  });

  it('sends conditional headers when cache metadata is provided', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        'If-None-Match': '"etag-value"',
        'If-Modified-Since': 'Thu, 02 Jan 2025 00:00:00 GMT'
      });

      return new Response(
        'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:cached\nDTSTART:20260101T000000Z\nEND:VEVENT\nEND:VCALENDAR',
        { status: 200 }
      );
    });

    const adapter = createHtmlIcsAdapter({
      fetch: fetchMock,
      now: () => NOW,
      cache: {
        etag: '"etag-value"',
        lastModified: 'Thu, 02 Jan 2025 00:00:00 GMT'
      }
    });

    await adapter.validate({
      feedUrl: 'https://calendar.example.com/feed.ics',
      targetCalendarLabel: 'Ops'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats HTTP 304 responses as success using cached validation metadata', async () => {
    const fetchMock = vi.fn(async () => ({
      status: 304,
      headers: new Headers({
        ETag: '"etag-latest"',
        'Last-Modified': 'Fri, 03 Jan 2025 00:00:00 GMT'
      }),
      ok: false,
      text: async () => ''
    }) as unknown as Response);

    const adapter = createHtmlIcsAdapter({
      fetch: fetchMock,
      now: () => NOW,
      cache: {
        etag: '"etag-previous"',
        lastModified: 'Thu, 02 Jan 2025 00:00:00 GMT'
      },
      previousValidation: {
        status: 'ok',
        maskedUrl: 'https://calendar.example.com/…/feed.ics',
        previewEvents: [
          {
            uid: 'cached-event',
            summary: 'Cached Meeting',
            startsAt: '2026-01-01T10:00:00.000Z',
            endsAt: '2026-01-01T11:00:00.000Z',
            allDay: false
          }
        ],
        lastSuccessfulFetchAt: '2026-01-01T00:00:00.000Z',
        issues: []
      }
    });

    const result = await adapter.validate({
      feedUrl: 'https://calendar.example.com/feed.ics',
      targetCalendarLabel: 'Ops'
    });

    expect(result.status).toBe('ok');
    expect(result.previewEvents).toEqual([
      {
        uid: 'cached-event',
        summary: 'Cached Meeting',
        startsAt: '2026-01-01T10:00:00.000Z',
        endsAt: '2026-01-01T11:00:00.000Z',
        allDay: false
      }
    ]);
    expect(result.lastSuccessfulFetchAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.cacheMetadata).toEqual({
      etag: '"etag-latest"',
      lastModified: 'Fri, 03 Jan 2025 00:00:00 GMT'
    });
  });

  it('maps abort errors to timeout issues', async () => {
    const fetchMock = vi.fn(async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    });

    const adapter = createHtmlIcsAdapter({ fetch: fetchMock, now: () => NOW });
    const result = await adapter.validate({
      feedUrl: 'https://calendar.example.com/slow.ics',
      targetCalendarLabel: 'Ops'
    });

    expect(result.status).toBe('failed');
    expect(result.issues[0].code).toBe('TIMEOUT');
  });

  it('treats empty feeds as parse errors', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    const adapter = createHtmlIcsAdapter({ fetch: fetchMock, now: () => NOW });

    const result = await adapter.validate({
      feedUrl: 'https://calendar.example.com/empty.ics',
      targetCalendarLabel: 'Ops'
    });

    expect(result.status).toBe('failed');
    expect(result.issues[0].code).toBe('PARSE_ERROR');
  });

  it('expands multi-day recurrence rules with BYDAY', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'BEGIN:VEVENT',
          'UID:recurring',
          'DTSTART;TZID=America/New_York:20260105T090000',
          'DTEND;TZID=America/New_York:20260105T093000',
          'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6',
          'SUMMARY:Ops Rotation',
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\n'),
        { status: 200 }
      )
    );

    const adapter = createHtmlIcsAdapter({ fetch: fetchMock, now: () => NOW });
    const result = await adapter.validate({
      feedUrl: 'https://calendar.example.com/recurring.ics',
      targetCalendarLabel: 'Ops'
    });

    expect(result.status).toBe('ok');
    expect(result.previewEvents).toHaveLength(5);
    const starts = result.previewEvents?.map((event) => event.startsAt);
    expect(starts?.slice(0, 3)).toEqual([
      '2026-01-05T14:00:00.000Z',
      '2026-01-07T14:00:00.000Z',
      '2026-01-09T14:00:00.000Z'
    ]);
  });

  it('resolves timezone aliases using bundled definitions', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'BEGIN:VEVENT',
          'UID:alias',
          'DTSTART;TZID=US/Eastern:20260110T120000',
          'DTEND;TZID=US/Eastern:20260110T130000',
          'SUMMARY:Alias Meeting',
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\n'),
        { status: 200 }
      )
    );

    const adapter = createHtmlIcsAdapter({ fetch: fetchMock, now: () => NOW });
    const result = await adapter.validate({
      feedUrl: 'https://calendar.example.com/alias.ics',
      targetCalendarLabel: 'Ops'
    });

    expect(result.status).toBe('ok');
    expect(result.previewEvents?.[0]).toMatchObject({
      startsAt: '2026-01-10T17:00:00.000Z',
      endsAt: '2026-01-10T18:00:00.000Z'
    });
  });
});
