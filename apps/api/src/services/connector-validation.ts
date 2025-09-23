import { randomUUID } from 'node:crypto';
import {
  ConnectorValidationResultSchema,
  ValidateConnectorRequestSchema,
  type ConnectorValidationResult,
  type HtmlIcsConnectorConfig
} from '@syncal/core';
import { maskFeedUrl } from '../lib/mask.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_PREVIEW_EVENTS = 5;

interface ConnectorValidationDependencies {
  fetch: typeof fetch;
  timeoutMs?: number;
}

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

export async function validateConnectorConfiguration(
  body: unknown,
  deps: ConnectorValidationDependencies
): Promise<ConnectorValidationResult> {
  const parsed = ValidateConnectorRequestSchema.parse(body);
  return validateHtmlIcs(parsed.config, deps);
}

async function validateHtmlIcs(
  config: HtmlIcsConnectorConfig,
  deps: ConnectorValidationDependencies
): Promise<ConnectorValidationResult> {
  const maskedUrl = maskFeedUrl(config.feedUrl);

  try {
    const feed = await fetchFeed(config, deps);
    const events = parseIcsEvents(feed);
    const upcoming = selectUpcoming(events, MAX_PREVIEW_EVENTS);

    const response = {
      status: 'ok',
      maskedUrl,
      previewEvents: upcoming,
      lastSuccessfulFetchAt: new Date().toISOString(),
      issues: upcoming.length === 0
        ? [
            {
              code: 'NO_UPCOMING_EVENTS',
              message: 'Feed fetched successfully but no upcoming events were found.',
              severity: 'warning'
            }
          ]
        : []
    } satisfies ConnectorValidationResult;

    return ConnectorValidationResultSchema.parse(response);
  } catch (error) {
    return ConnectorValidationResultSchema.parse({
      status: 'failed',
      maskedUrl,
      issues: mapErrorToIssues(error)
    });
  }
}

async function fetchFeed(
  config: HtmlIcsConnectorConfig,
  deps: ConnectorValidationDependencies
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);

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

    const text = await response.text();

    if (!response.ok) {
      throw new HttpError('Feed responded with an error', response.status, text);
    }

    if (!text.trim()) {
      throw new ParseError('Feed response was empty.');
    }

    return text;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Validation timed out');
    }

    throw new Error('Unable to fetch feed');
  } finally {
    clearTimeout(timeout);
  }
}

interface IcsEventPreview {
  uid: string;
  summary?: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
}

function parseIcsEvents(content: string): IcsEventPreview[] {
  const unfolded = unfoldLines(content);
  const events: IcsEventPreview[] = [];
  let current: Record<string, IcsProperty[]> | null = null;

  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      if (current) {
        const event = toEventPreview(current);
        if (event) {
          events.push(event);
        }
      }
      current = null;
      continue;
    }

    if (current) {
      const prop = parseProperty(line);
      if (prop) {
        (current[prop.name] ||= []).push(prop);
      }
    }
  }

  return events;
}

interface IcsProperty {
  name: string;
  params: Record<string, string>;
  value: string;
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
    if (!key || !raw) continue;
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

function toEventPreview(properties: Record<string, IcsProperty[]>): IcsEventPreview | null {
  const dtStart = properties.DTSTART?.[0];
  if (!dtStart) {
    return null;
  }

  const uid = properties.UID?.[0]?.value ?? randomUUID();
  const summary = properties.SUMMARY?.[0]?.value;

  const start = toIsoDate(dtStart.value, dtStart.params);
  if (!start) {
    return null;
  }

  const endProp = properties.DTEND?.[0];
  const end = endProp ? toIsoDate(endProp.value, endProp.params) : null;

  return {
    uid,
    summary,
    startsAt: start.iso,
    endsAt: end?.iso,
    allDay: start.allDay || Boolean(end?.allDay)
  } satisfies IcsEventPreview;
}

function toIsoDate(value: string, params: Record<string, string>): { iso: string; allDay: boolean } | null {
  const sanitized = value.trim();
  if (!sanitized) {
    return null;
  }

  const match = sanitized.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);
  if (!match) {
    return null;
  }

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr ?? '0');
  const minute = Number(minuteStr ?? '0');
  const second = Number(secondStr ?? '0');

  if ([year, month, day, hour, minute, second].some((part) => Number.isNaN(part))) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const iso = new Date(timestamp).toISOString();
  const allDay = params.VALUE === 'DATE' || !hourStr;

  return { iso, allDay };
}

function selectUpcoming(events: IcsEventPreview[], limit: number): IcsEventPreview[] {
  const now = Date.now();
  return events
    .filter((event) => !Number.isNaN(Date.parse(event.startsAt)) && Date.parse(event.startsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, limit);
}

function mapErrorToIssues(error: unknown) {
  if (error instanceof HttpError) {
    return [
      {
        code: `HTTP_${error.status}`,
        message: error.status === 401 || error.status === 403
          ? 'Authentication failed while attempting to fetch the feed.'
          : `Feed responded with status ${error.status}.`,
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

  if (error instanceof Error && error.message === 'Validation timed out') {
    return [
      {
        code: 'TIMEOUT',
        message: 'Validation timed out after 30 seconds. The feed may be slow or unavailable.',
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
