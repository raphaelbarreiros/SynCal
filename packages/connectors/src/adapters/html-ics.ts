import { randomUUID } from 'node:crypto';
import {
  ConnectorValidationResultSchema,
  type ConnectorValidationResult,
  type HtmlIcsConnectorConfig,
  type ValidationIssue
} from '@syncal/core';
import { HtmlIcsAdapterOptions, type ConnectorAdapter } from '../types.js';
import { maskFeedUrl } from '../utils/mask.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_PREVIEW_EVENTS = 5;
const MAX_RECURRENCE_ITERATIONS = 100;

class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly body: string) {
    super(message);
    this.name = 'HttpError';
  }
}

class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface FetchDependencies {
  fetch: typeof fetch;
  timeoutMs: number;
}

interface IcsProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: Date;
}

interface NormalizedEvent {
  uid: string;
  summary?: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  durationMs?: number;
  recurrence?: RecurrenceRule;
  exceptions: Date[];
}

interface Occurrence {
  uid: string;
  summary?: string;
  start: Date;
  end?: Date;
  allDay: boolean;
}

export function createHtmlIcsAdapter(options: HtmlIcsAdapterOptions = {}): ConnectorAdapter {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const nowFactory = options.now ?? (() => new Date());

  return {
    provider: 'html_ics',
    async validate(config: HtmlIcsConnectorConfig): Promise<ConnectorValidationResult> {
      const maskedUrl = maskFeedUrl(config.feedUrl);

      try {
        const feed = await fetchFeed(config, { fetch: fetchImpl, timeoutMs });
        const events = parseIcsEvents(feed);
        const now = nowFactory();
        const occurrences = collectUpcomingOccurrences(events, now, MAX_PREVIEW_EVENTS);

        const issues: ValidationIssue[] =
          occurrences.length === 0
            ? [
                {
                  code: 'NO_UPCOMING_EVENTS',
                  message: 'Feed fetched successfully but no upcoming events were found.',
                  severity: 'warning'
                }
              ]
            : [];

        return ConnectorValidationResultSchema.parse({
          status: 'ok',
          maskedUrl,
          previewEvents: occurrences.map((occurrence) => ({
            uid: occurrence.uid,
            summary: occurrence.summary,
            startsAt: occurrence.start.toISOString(),
            endsAt: occurrence.end?.toISOString(),
            allDay: occurrence.allDay
          })),
          lastSuccessfulFetchAt: now.toISOString(),
          issues
        });
      } catch (error) {
        return ConnectorValidationResultSchema.parse({
          status: 'failed',
          maskedUrl,
          issues: mapErrorToIssues(error)
        });
      }
    }
  } satisfies ConnectorAdapter;
}

async function fetchFeed(
  config: HtmlIcsConnectorConfig,
  deps: FetchDependencies
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: 'text/calendar, text/plain; q=0.8, */*; q=0.5'
    };

    if (config.authHeader && config.authToken) {
      headers[config.authHeader] = config.authToken;
    }

    const response = await deps.fetch(config.feedUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    const body = await response.text();

    if (!response.ok) {
      throw new HttpError('Feed responded with an error', response.status, body);
    }

    if (!body.trim()) {
      throw new ParseError('Feed response was empty.');
    }

    return body;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error instanceof ParseError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError('Validation timed out');
    }

    throw new Error('Unable to fetch feed');
  } finally {
    clearTimeout(timeout);
  }
}

function parseIcsEvents(payload: string): NormalizedEvent[] {
  const lines = unfoldLines(payload);
  const events: NormalizedEvent[] = [];
  let current: Record<string, IcsProperty[]> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      if (current) {
        const event = toEvent(current);
        if (event) {
          events.push(event);
        }
      }
      current = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const property = parseProperty(line);
    if (property) {
      (current[property.name] ||= []).push(property);
    }
  }

  return events;
}

function unfoldLines(payload: string): string[] {
  const result: string[] = [];
  const rawLines = payload.split(/\r?\n/);

  for (const line of rawLines) {
    if (!line) {
      continue;
    }

    if ((line.startsWith(' ') || line.startsWith('\t')) && result.length > 0) {
      result[result.length - 1] += line.slice(1);
    } else {
      result.push(line);
    }
  }

  return result;
}

function parseProperty(line: string): IcsProperty | null {
  const delimiter = line.indexOf(':');
  if (delimiter === -1) {
    return null;
  }

  const head = line.slice(0, delimiter);
  const value = decodeValue(line.slice(delimiter + 1));
  const segments = head.split(';');
  const name = segments.shift()?.toUpperCase();
  if (!name) {
    return null;
  }

  const params: Record<string, string> = {};
  for (const segment of segments) {
    const [key, raw] = segment.split('=');
    if (!key || !raw) {
      continue;
    }
    params[key.toUpperCase()] = raw;
  }

  return { name, params, value } satisfies IcsProperty;
}

function decodeValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function toEvent(properties: Record<string, IcsProperty[]>): NormalizedEvent | null {
  const dtStart = properties.DTSTART?.[0];
  if (!dtStart) {
    return null;
  }

  const parsedStart = parseDate(dtStart.value, dtStart.params);
  if (!parsedStart) {
    return null;
  }

  const endProp = properties.DTEND?.[0];
  const parsedEnd = endProp ? parseDate(endProp.value, endProp.params) : null;

  const uid = properties.UID?.[0]?.value ?? randomUUID();
  const summary = properties.SUMMARY?.[0]?.value;

  const recurrence = properties.RRULE?.[0]?.value
    ? parseRecurrenceRule(properties.RRULE[0].value)
    : undefined;

  const exceptions: Date[] = [];
  if (properties.EXDATE) {
    for (const ex of properties.EXDATE) {
      const parsed = parseDate(ex.value, ex.params);
      if (parsed) {
        exceptions.push(parsed.date);
      }
    }
  }

  const durationMs = parsedEnd ? parsedEnd.date.getTime() - parsedStart.date.getTime() : undefined;

  return {
    uid,
    summary,
    start: parsedStart.date,
    end: parsedEnd?.date,
    allDay: parsedStart.allDay || Boolean(parsedEnd?.allDay),
    durationMs: durationMs && Number.isFinite(durationMs) ? durationMs : undefined,
    recurrence,
    exceptions
  } satisfies NormalizedEvent;
}

function parseDate(value: string, params: Record<string, string>): { date: Date; allDay: boolean } | null {
  const sanitized = value.trim();
  if (!sanitized) {
    return null;
  }

  const allDay = params.VALUE === 'DATE' || /^\d{8}$/.test(sanitized);

  const match = sanitized.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);
  if (!match) {
    return null;
  }

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr, utcFlag] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr ?? '0');
  const minute = Number(minuteStr ?? '0');
  const second = Number(secondStr ?? '0');

  if ([year, month, day, hour, minute, second].some((part) => Number.isNaN(part))) {
    return null;
  }

  if (allDay) {
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    return { date, allDay: true };
  }

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  if (utcFlag === 'Z') {
    return { date: new Date(naiveUtc), allDay: false };
  }

  const timeZone = params.TZID;
  if (timeZone) {
    const offset = getTimeZoneOffset(new Date(naiveUtc), timeZone);
    if (offset !== null) {
      return { date: new Date(naiveUtc - offset), allDay: false };
    }
  }

  return { date: new Date(naiveUtc), allDay: false };
}

function parseRecurrenceRule(value: string): RecurrenceRule | undefined {
  const segments = value.split(';');
  const entries = new Map<string, string>();
  for (const segment of segments) {
    const [key, raw] = segment.split('=');
    if (key && raw) {
      entries.set(key.toUpperCase(), raw);
    }
  }

  const freq = entries.get('FREQ') as RecurrenceRule['freq'] | undefined;
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) {
    return undefined;
  }

  const interval = Number(entries.get('INTERVAL') ?? '1');
  const count = entries.has('COUNT') ? Number(entries.get('COUNT')) : undefined;
  const untilRaw = entries.get('UNTIL');
  const until = untilRaw ? parseDate(untilRaw, {})?.date : undefined;

  return {
    freq,
    interval: Number.isFinite(interval) && interval > 0 ? interval : 1,
    count: count && Number.isFinite(count) && count > 0 ? count : undefined,
    until
  } satisfies RecurrenceRule;
}

function getTimeZoneOffset(date: Date, timeZone: string): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const values: Record<string, number> = {};
    for (const part of parts) {
      if (part.type === 'literal') {
        continue;
      }
      values[part.type] = Number(part.value);
    }

    if (
      values.year === undefined ||
      values.month === undefined ||
      values.day === undefined ||
      values.hour === undefined ||
      values.minute === undefined ||
      values.second === undefined
    ) {
      return null;
    }

    const asUtc = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second
    );

    return asUtc - date.getTime();
  } catch {
    return null;
  }
}

function collectUpcomingOccurrences(
  events: NormalizedEvent[],
  now: Date,
  limit: number
): Occurrence[] {
  const occurrences: Occurrence[] = [];

  for (const event of events) {
    const expanded = expandOccurrences(event, now, limit);
    occurrences.push(...expanded);
  }

  occurrences.sort((a, b) => a.start.getTime() - b.start.getTime());
  return occurrences.slice(0, limit);
}

function expandOccurrences(event: NormalizedEvent, now: Date, limit: number): Occurrence[] {
  const results: Occurrence[] = [];
  const baseDuration = event.durationMs ?? undefined;

  const hasRecurrence = Boolean(event.recurrence);

  const addOccurrence = (start: Date) => {
    if (start.getTime() < now.getTime()) {
      return;
    }

    if (event.exceptions.some((exception) => exception.getTime() === start.getTime())) {
      return;
    }

    const end = baseDuration ? new Date(start.getTime() + baseDuration) : event.end;
    results.push({
      uid: buildOccurrenceUid(event.uid, start, hasRecurrence),
      summary: event.summary,
      start,
      end,
      allDay: event.allDay
    });
  };

  addOccurrence(event.start);

  if (!event.recurrence) {
    return results.slice(0, limit);
  }

  let current = event.start;
  let iterations = 0;
  let emitted = 1;

  while (iterations < MAX_RECURRENCE_ITERATIONS && emitted < limit) {
    iterations += 1;
    const next = nextOccurrence(current, event.recurrence);
    if (!next) {
      break;
    }

    if (event.recurrence.until && next.getTime() > event.recurrence.until.getTime()) {
      break;
    }

    current = next;
    addOccurrence(current);
    emitted = results.length;

    if (event.recurrence.count && emitted >= event.recurrence.count) {
      break;
    }
  }

  return results.slice(0, limit);
}

function nextOccurrence(base: Date, rule: RecurrenceRule): Date | null {
  const next = new Date(base.getTime());

  switch (rule.freq) {
    case 'DAILY':
      next.setUTCDate(next.getUTCDate() + rule.interval);
      return next;
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7 * rule.interval);
      return next;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + rule.interval);
      return next;
    case 'YEARLY':
      next.setUTCFullYear(next.getUTCFullYear() + rule.interval);
      return next;
    default:
      return null;
  }
}

function buildOccurrenceUid(uid: string, start: Date, hasRecurrence: boolean): string {
  if (!hasRecurrence) {
    return uid;
  }

  return `${uid}:${start.toISOString()}`;
}

function mapErrorToIssues(error: unknown): ValidationIssue[] {
  if (error instanceof HttpError) {
    return [
      {
        code: `HTTP_${error.status}`,
        message:
          error.status === 401 || error.status === 403
            ? 'Authentication failed while attempting to fetch the feed.'
            : `Feed responded with status ${error.status}.`,
        severity: 'error'
      }
    ];
  }

  if (error instanceof TimeoutError) {
    return [
      {
        code: 'TIMEOUT',
        message: 'Validation timed out after 30 seconds. The feed may be slow or unavailable.',
        severity: 'error'
      }
    ];
  }

  if (error instanceof ParseError) {
    return [
      {
        code: 'PARSE_ERROR',
        message: error.message,
        severity: 'error'
      }
    ];
  }

  return [
    {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the feed. Check the URL and network connectivity.',
      severity: 'error'
    }
  ];
}
