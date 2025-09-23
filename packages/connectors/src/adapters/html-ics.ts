import { randomUUID } from 'node:crypto';
import IcalExpander from 'ical-expander';
import { parseICS } from 'node-ical';
import {
  ConnectorValidationResultSchema,
  type ConnectorValidationResult,
  type HtmlIcsConnectorConfig,
  type HtmlIcsFetchCache,
  type HtmlIcsValidationMetadata,
  type ValidationIssue
} from '@syncal/core';
import { HtmlIcsAdapterOptions, type ConnectorAdapter } from '../types.js';
import { maskFeedUrl } from '../utils/mask.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_PREVIEW_EVENTS = 5;
const PREVIEW_LOOKAHEAD_DAYS = 180;

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

class NotModifiedError extends Error {
  constructor(readonly cacheMetadata?: HtmlIcsFetchCache) {
    super('Feed not modified');
    this.name = 'NotModifiedError';
  }
}

interface FetchDependencies {
  fetch: typeof fetch;
  timeoutMs: number;
}

interface ValidateFeedDependencies extends FetchDependencies {
  nowFactory: () => Date;
  cache?: HtmlIcsFetchCache;
  previousValidation?: HtmlIcsValidationMetadata;
}

interface FetchFeedResult {
  body: string;
  cacheMetadata?: HtmlIcsFetchCache;
}

interface PreviewEvent {
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
  const cache = options.cache ?? undefined;
  const previousValidation = options.previousValidation ?? undefined;

  return {
    provider: 'html_ics',
    async validate(config: HtmlIcsConnectorConfig): Promise<ConnectorValidationResult> {
      return validateHtmlIcsFeed(config, {
        fetch: fetchImpl,
        timeoutMs,
        nowFactory,
        cache,
        previousValidation
      });
    }
  } satisfies ConnectorAdapter;
}

export async function validateHtmlIcsFeed(
  config: HtmlIcsConnectorConfig,
  deps: ValidateFeedDependencies
): Promise<ConnectorValidationResult> {
  const maskedUrl = maskFeedUrl(config.feedUrl);

  try {
    const feed = await fetchFeed(config, deps, deps.cache);
    const now = deps.nowFactory();
    const previewEvents = extractPreviewEvents(feed.body, now, MAX_PREVIEW_EVENTS);

    const issues: ValidationIssue[] =
      previewEvents.length === 0
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
      previewEvents: previewEvents.map((preview) => ({
        uid: preview.uid,
        summary: preview.summary,
        startsAt: preview.start.toISOString(),
        endsAt: preview.end?.toISOString(),
        allDay: preview.allDay
      })),
      lastSuccessfulFetchAt: now.toISOString(),
      issues,
      cacheMetadata: feed.cacheMetadata
    });
  } catch (error) {
    if (error instanceof NotModifiedError) {
      const cacheMetadata = error.cacheMetadata ?? deps.cache;
      const previous = deps.previousValidation;

      if (previous) {
        return ConnectorValidationResultSchema.parse({
          status: 'ok',
          maskedUrl: previous.maskedUrl ?? maskedUrl,
          previewEvents: previous.previewEvents,
          lastSuccessfulFetchAt: previous.lastSuccessfulFetchAt,
          issues: previous.issues,
          cacheMetadata
        });
      }

      return ConnectorValidationResultSchema.parse({
        status: 'ok',
        maskedUrl,
        previewEvents: [],
        lastSuccessfulFetchAt: cacheMetadata?.lastModified,
        issues: [],
        cacheMetadata
      });
    }

    const issues = mapErrorToIssues(error);

    return ConnectorValidationResultSchema.parse({
      status: 'failed',
      maskedUrl,
      issues
    });
  }
}

async function fetchFeed(
  config: HtmlIcsConnectorConfig,
  deps: FetchDependencies,
  cache?: HtmlIcsFetchCache
): Promise<FetchFeedResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: 'text/calendar, text/plain; q=0.8, */*; q=0.5'
    };

    if (config.authHeader && config.authToken) {
      headers[config.authHeader] = config.authToken;
    }

    if (cache?.etag) {
      headers['If-None-Match'] = cache.etag;
    }

    if (cache?.lastModified) {
      headers['If-Modified-Since'] = cache.lastModified;
    }

    const response = await deps.fetch(config.feedUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    const etag = response.headers.get('etag') ?? cache?.etag ?? undefined;
    const lastModified = response.headers.get('last-modified') ?? cache?.lastModified ?? undefined;

    const cacheMetadata =
      etag || lastModified
        ? {
            ...(etag ? { etag } : {}),
            ...(lastModified ? { lastModified } : {})
          }
        : undefined;

    if (response.status === 304) {
      throw new NotModifiedError(cacheMetadata);
    }

    const body = await response.text();

    if (!response.ok) {
      throw new HttpError('Feed responded with an error', response.status, body);
    }

    if (!body.trim()) {
      throw new ParseError('Feed response was empty.');
    }

    return {
      body,
      cacheMetadata
    } satisfies FetchFeedResult;
  } catch (error) {
    if (error instanceof NotModifiedError) {
      throw error;
    }

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

function extractPreviewEvents(ics: string, now: Date, limit: number): PreviewEvent[] {
  try {
    const calendar = parseICS(ics);
    const hasEvents = Object.values(calendar).some((component) => component?.type === 'VEVENT');
    if (!hasEvents) {
      throw new ParseError('No calendar events were found in the feed.');
    }
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }
    throw new ParseError('The feed could not be parsed as a valid iCalendar file.');
  }

  let expander: IcalExpander;
  try {
    expander = new IcalExpander({ ics, maxIterations: 5_000, skipInvalidDates: true });
  } catch (error) {
    throw new ParseError('The feed contains unsupported recurrence or timezone data.');
  }

  const lookahead = addDays(now, PREVIEW_LOOKAHEAD_DAYS);
  const { events, occurrences } = expander.between(now, lookahead);

  const upcoming: PreviewEvent[] = [];

  for (const event of events) {
    const start = event.startDate.toJSDate();
    if (start.getTime() < now.getTime()) {
      continue;
    }

    upcoming.push({
      uid: event.uid ?? randomUUID(),
      summary: event.summary ?? undefined,
      start,
      end: event.endDate?.toJSDate(),
      allDay: event.startDate.isDate
    });
  }

  for (const occurrence of occurrences) {
    const start = occurrence.startDate.toJSDate();
    if (start.getTime() < now.getTime()) {
      continue;
    }

    const baseUid = occurrence.item.uid ?? randomUUID();
    const occurrenceUid = `${baseUid}:${start.toISOString()}`;

    upcoming.push({
      uid: occurrenceUid,
      summary: occurrence.item.summary ?? undefined,
      start,
      end: occurrence.endDate?.toJSDate(),
      allDay: occurrence.startDate.isDate
    });
  }

  upcoming.sort((a, b) => a.start.getTime() - b.start.getTime());

  return upcoming.slice(0, limit);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
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
