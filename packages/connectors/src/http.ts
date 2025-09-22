import { ProviderRequestError } from './errors.js';

interface FetchOptions extends RequestInit {
  query?: Record<string, string | number | undefined | null>;
}

function buildUrl(base: string, query?: FetchOptions['query']): string {
  if (!query) {
    return base;
  }

  const url = new URL(base);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    url.searchParams.append(key, String(value));
  }

  return url.toString();
}

export async function httpJson<T = unknown>(
  baseUrl: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = buildUrl(baseUrl, options.query);
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  const content = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ProviderRequestError('Provider request failed', response.status, content);
  }

  return content as T;
}
