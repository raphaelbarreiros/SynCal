#!/usr/bin/env tsx

interface SeedOptions {
  pairId: string;
  connectorId?: string;
  windowStart: string;
  windowEnd: string;
  priority: number;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  baseUrl: string;
  adminEmail: string;
  adminPassword: string;
}

interface CookieJar {
  setCookie(header: string): void;
  header(): string | undefined;
}

function createCookieJar(): CookieJar {
  const store = new Map<string, string>();

  return {
    setCookie(header: string) {
      const parts = header.split(';')[0];
      const [name, value] = parts.split('=');
      if (name && value) {
        store.set(name.trim(), value.trim());
      }
    },
    header() {
      if (store.size === 0) {
        return undefined;
      }

      return Array.from(store.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
    }
  };
}

function parseArgs(): SeedOptions {
  const args = new Map<string, string>();

  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    const value = process.argv[i + 1];

    if (!key || !value) {
      break;
    }

    if (!key.startsWith('--')) {
      throw new Error(`Unexpected argument: ${key}`);
    }

    args.set(key.slice(2), value);
  }

  const pairId = args.get('pair') ?? process.env.SEED_PAIR_ID;
  if (!pairId) {
    throw new Error('Missing pair id (provide --pair or set SEED_PAIR_ID).');
  }

  const start =
    args.get('start') ?? new Date().toISOString();
  const end =
    args.get('end') ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const priority = Number.parseInt(args.get('priority') ?? '0', 10);

  const baseUrl = args.get('url') ?? process.env.API_BASE_URL ?? 'http://localhost:3001';
  const adminEmail =
    args.get('email') ?? process.env.SEED_ADMIN_EMAIL ?? process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword =
    args.get('password') ??
    process.env.SEED_ADMIN_PASSWORD ??
    process.env.INITIAL_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('Missing admin credentials. Provide --email/--password or set SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD.');
  }

  const payload = args.get('payload') ? JSON.parse(args.get('payload')!) : {};

  return {
    pairId,
    connectorId: args.get('connector'),
    windowStart: start,
    windowEnd: end,
    priority,
    payload,
    idempotencyKey: args.get('idempotency'),
    baseUrl,
    adminEmail,
    adminPassword
  } satisfies SeedOptions;
}

async function fetchWithCookies(
  url: string,
  init: RequestInit,
  jar: CookieJar
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined)
  };
  const cookieHeader = jar.header();
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  const response = await fetch(url, { ...init, headers });
  const cookies = (response.headers as any).getSetCookie?.() as string[] | undefined;

  for (const value of cookies ?? []) {
    jar.setCookie(value);
  }

  return response;
}

async function requestCsrf(baseUrl: string, jar: CookieJar): Promise<string> {
  const response = await fetchWithCookies(`${baseUrl}/auth/csrf`, { method: 'GET' }, jar);
  const body = (await response.json()) as { token: string };
  return body.token;
}

async function authenticate(options: SeedOptions, jar: CookieJar): Promise<void> {
  const csrfToken = await requestCsrf(options.baseUrl, jar);

  const response = await fetchWithCookies(
    `${options.baseUrl}/auth/session`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': csrfToken
      },
      body: JSON.stringify({ email: options.adminEmail, password: options.adminPassword })
    },
    jar
  );

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}`);
  }
}

async function schedule(options: SeedOptions, jar: CookieJar): Promise<void> {
  const csrfToken = await requestCsrf(options.baseUrl, jar);

  const response = await fetchWithCookies(
    `${options.baseUrl}/jobs/schedule`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': csrfToken,
        ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {})
      },
      body: JSON.stringify({
        pairId: options.pairId,
        connectorId: options.connectorId,
        priority: options.priority,
        payload: options.payload,
        window: {
          start: options.windowStart,
          end: options.windowEnd
        }
      })
    },
    jar
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Scheduling failed (${response.status}): ${JSON.stringify(body)}`);
  }

  console.log('Scheduled job:', body);
}

async function main() {
  try {
    const options = parseArgs();
    const jar = createCookieJar();
    await authenticate(options, jar);
    await schedule(options, jar);
  } catch (error) {
    console.error('Seed script failed:', error);
    process.exitCode = 1;
  }
}

await main();
