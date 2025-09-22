import type { FastifySessionObject } from '@fastify/session';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  buildGoogleAuthorizationUrl,
  buildMicrosoftAuthorizationUrl,
  createPkcePair,
  type OAuthCallbackPayload,
  type OAuthProvider
} from '@syncal/connectors';
import { z } from 'zod';
import {
  ConnectorConfigSchema,
  ConnectorResponseSchema,
  CreateConnectorRequestSchema,
  OAuthContextResponseSchema,
  OAuthProviderSchema,
  StartOAuthRequestSchema,
  type ConnectorConfig,
  type ConnectorResponse,
  type CreateConnectorRequest,
  type OAuthContextResponse,
  type OAuthProvider as OAuthProviderCore,
  type StartOAuthResponse
} from '@syncal/core';
import { encryptJson, type AppEnv } from '@syncal/config';
import type {
  AuditLogRepository,
  CalendarRepository,
  ConnectorRepository
} from '../repositories/index.js';
import {
  consumeOAuthSession,
  generateStateToken,
  getOAuthSessionEntry,
  listPublicOAuthContext,
  saveOAuthRequest,
  storeOAuthCallback
} from '../lib/oauth.js';
import type { ConnectorRegistry } from '../plugins/connectors.js';
import type { AdminSession } from '../lib/session.js';

const OAuthCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional()
});

export interface ConnectorServiceDependencies {
  env: AppEnv;
  connectorRegistry: ConnectorRegistry;
  connectors: ConnectorRepository;
  calendars: CalendarRepository;
  auditLogs: AuditLogRepository;
  prisma: PrismaClient;
}

function toJsonValue<T>(value: T): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

function getScopesForProvider(env: AppEnv, provider: OAuthProvider): string[] {
  const raw =
    provider === 'google' ? env.GOOGLE_OAUTH_SCOPES : env.MS_OAUTH_SCOPES;

  return raw
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface MicrosoftCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenantId: string;
}

function requireGoogleCredentials(env: AppEnv): GoogleCredentials {
  const missing: string[] = [];
  if (!env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
  if (!env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  if (!env.GOOGLE_REDIRECT_URI) missing.push('GOOGLE_REDIRECT_URI');

  if (missing.length > 0) {
    throw new Error(`Google OAuth is not configured. Set ${missing.join(', ')}.`);
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI
  };
}

function requireMicrosoftCredentials(env: AppEnv): MicrosoftCredentials {
  const missing: string[] = [];
  if (!env.MS_CLIENT_ID) missing.push('MS_CLIENT_ID');
  if (!env.MS_CLIENT_SECRET) missing.push('MS_CLIENT_SECRET');
  if (!env.MS_REDIRECT_URI) missing.push('MS_REDIRECT_URI');
  if (!env.MS_TENANT_ID) missing.push('MS_TENANT_ID');

  if (missing.length > 0) {
    throw new Error(`Microsoft OAuth is not configured. Set ${missing.join(', ')}.`);
  }

  return {
    clientId: env.MS_CLIENT_ID,
    clientSecret: env.MS_CLIENT_SECRET,
    redirectUri: env.MS_REDIRECT_URI,
    tenantId: env.MS_TENANT_ID
  };
}

function buildAuthorizationUrl(
  provider: OAuthProvider,
  env: AppEnv,
  state: string,
  codeChallenge?: string
): string {
  const scopes = getScopesForProvider(env, provider);

  if (provider === 'google') {
    const { clientId, redirectUri } = requireGoogleCredentials(env);
    return buildGoogleAuthorizationUrl({
      clientId,
      redirectUri,
      scopes,
      state,
      codeChallenge
    }).authorizationUrl;
  }

  const { clientId, redirectUri, tenantId } = requireMicrosoftCredentials(env);
  return buildMicrosoftAuthorizationUrl(
    { tenantId },
    {
      clientId,
      redirectUri,
      scopes,
      state,
      codeChallenge
    }
  ).authorizationUrl;
}

export function startOAuthFlow(
  session: FastifySessionObject,
  body: unknown,
  deps: ConnectorServiceDependencies
): StartOAuthResponse {
  const parsed = StartOAuthRequestSchema.parse(body);
  const provider = parsed.provider as OAuthProvider;
  const { verifier, challenge } = createPkcePair();
  const state = generateStateToken();
  const scopes = getScopesForProvider(deps.env, provider);

  saveOAuthRequest(session, {
    provider,
    state,
    codeVerifier: verifier,
    createdAt: new Date().toISOString(),
    scopes
  });

  const authorizationUrl = buildAuthorizationUrl(provider, deps.env, state, challenge);

  return {
    provider: parsed.provider,
    authorizationUrl,
    state
  } satisfies StartOAuthResponse;
}

export async function handleOAuthCallback(
  session: FastifySessionObject,
  providerParam: unknown,
  query: unknown,
  deps: ConnectorServiceDependencies
): Promise<void> {
  const provider = OAuthProviderSchema.parse(providerParam) as OAuthProvider;
  const parsedQuery = OAuthCallbackQuerySchema.parse(query);

  if (parsedQuery.error) {
    throw new Error(parsedQuery.error_description ?? parsedQuery.error);
  }

  if (!parsedQuery.code || !parsedQuery.state) {
    throw new Error('Missing authorization code or state');
  }

  const entry = getOAuthSessionEntry(session, parsedQuery.state);
  if (!entry) {
    throw new Error('OAuth state not found or expired');
  }

  if (entry.provider !== provider) {
    throw new Error('Provider mismatch for OAuth flow');
  }

  const adapter = deps.connectorRegistry.getAdapter(provider);
  const env = deps.env;
  const scopes = entry.scopes;

  const tokensPayload = await adapter.exchangeCode({
    code: parsedQuery.code,
    redirectUri:
      provider === 'google'
        ? requireGoogleCredentials(env).redirectUri
        : requireMicrosoftCredentials(env).redirectUri,
    clientId:
      provider === 'google'
        ? requireGoogleCredentials(env).clientId
        : requireMicrosoftCredentials(env).clientId,
    clientSecret:
      provider === 'google'
        ? requireGoogleCredentials(env).clientSecret
        : requireMicrosoftCredentials(env).clientSecret,
    codeVerifier: entry.codeVerifier,
    scopes
  });

  const calendars = await adapter.listCalendars(tokensPayload.tokens);

  const payload: OAuthCallbackPayload = {
    tokens: tokensPayload.tokens,
    profile: tokensPayload.profile,
    calendars
  };

  storeOAuthCallback(session, parsedQuery.state, payload);
}

function toConnectorConfig(
  provider: OAuthProviderCore,
  entryPayload: OAuthCallbackPayload,
  scopes: string[],
  selectedCalendarIds: string[],
  validation?: ConnectorConfig['validation']
): ConnectorConfig {
  const discovered = entryPayload.calendars.map((calendar) => ({
    id: calendar.id,
    name: calendar.name,
    description: calendar.description,
    timeZone: calendar.timeZone,
    isPrimary: calendar.isPrimary,
    canEdit: calendar.canEdit
  }));

  return {
    provider,
    profile: entryPayload.profile,
    scopes,
    discoveredCalendars: discovered,
    selectedCalendarIds,
    validation
  } satisfies ConnectorConfig;
}

export async function listOAuthContext(
  session: FastifySessionObject
): Promise<OAuthContextResponse> {
  return OAuthContextResponseSchema.parseAsync({
    entries: listPublicOAuthContext(session)
  });
}

interface CreateConnectorOptions {
  body: unknown;
  session: FastifySessionObject;
  admin: AdminSession;
  deps: ConnectorServiceDependencies;
}

async function queueConnectorValidationJob(
  prisma: PrismaClient,
  connectorId: string,
  calendarIds: string[],
  referenceTime: Date
): Promise<void> {
  if (calendarIds.length === 0) {
    return;
  }

  const primaryCalendarId = calendarIds[0];

  const validationPair = await prisma.syncPair.upsert({
    where: {
      primaryCalendarId_secondaryCalendarId: {
        primaryCalendarId,
        secondaryCalendarId: primaryCalendarId
      }
    },
    update: {},
    create: {
      primaryCalendarId,
      secondaryCalendarId: primaryCalendarId,
      fallbackOrder: []
    }
  });

  const existingJob = await prisma.syncJob.findFirst({
    where: {
      connectorId,
      pairId: validationPair.id,
      status: {
        in: ['pending', 'retrying', 'in_progress']
      }
    }
  });

  if (existingJob) {
    return;
  }

  const windowStart = referenceTime;
  const windowEnd = new Date(referenceTime.getTime() + 2 * 60 * 60 * 1000);
  const nextRunAt = new Date(referenceTime.getTime() + 60 * 60 * 1000);

  const payload: Prisma.JsonObject = {
    type: 'connector_validation',
    connectorId,
    calendarIds
  };

  await prisma.syncJob.create({
    data: {
      pairId: validationPair.id,
      connectorId,
      windowStart,
      windowEnd,
      payload,
      nextRunAt
    }
  });
}

export async function createConnector({
  body,
  session,
  admin,
  deps
}: CreateConnectorOptions): Promise<ConnectorResponse> {
  const parsed = CreateConnectorRequestSchema.parse(body);
  const provider = parsed.type as OAuthProvider;

  const entry = consumeOAuthSession(session, parsed.state);
  if (!entry || !entry.payload) {
    throw new Error('OAuth state has not been authorized or has expired');
  }

  if (entry.provider !== provider) {
    throw new Error('Provider mismatch for connector creation');
  }

  const payload = entry.payload;
  const adapter = deps.connectorRegistry.getAdapter(provider);
  const selectedIds = new Set(parsed.selectedCalendars.map((item) => item.providerCalendarId));

  const calendarMap = new Map(payload.calendars.map((calendar) => [calendar.id, calendar]));
  const missing = Array.from(selectedIds).filter((id) => !calendarMap.has(id));
  if (missing.length > 0) {
    throw new Error(`Unknown calendars selected: ${missing.join(', ')}`);
  }

  const credentialsPayload = {
    provider,
    tokens: payload.tokens,
    profile: payload.profile,
    scopes: entry.scopes
  };

  const encryptedCredentials = encryptJson(credentialsPayload);

  const now = new Date();
  let validationState: ConnectorConfig['validation'] = {
    status: 'pending'
  };
  let status: ConnectorResponse['status'] = 'pending_validation';
  let lastValidatedAt: Date | null = null;

  const baseConfig = toConnectorConfig(
    parsed.type,
    payload,
    entry.scopes,
    Array.from(selectedIds)
  );
  const baseConfigJson = toJsonValue(baseConfig) as Prisma.InputJsonValue;

  const connector = await deps.connectors.create({
    ownerId: admin.id,
    type: provider,
    displayName: parsed.displayName ?? payload.profile?.name ?? null,
    credentialsEncrypted: encryptedCredentials,
    config: baseConfigJson,
    status,
    lastValidatedAt
  });

  const calendars = await deps.calendars.upsertMany(
    parsed.selectedCalendars.map((selection) => {
      const calendar = calendarMap.get(selection.providerCalendarId)!;
      const metadata = toJsonValue({
        raw: calendar.raw ?? null,
        timeZone: calendar.timeZone ?? null,
        isPrimary: calendar.isPrimary,
        canEdit: calendar.canEdit
      }) as Prisma.InputJsonValue;
      return {
        connectorId: connector.id,
        providerCalendarId: calendar.id,
        displayName: selection.displayName ?? calendar.name,
        privacyMode: selection.privacyMode,
        metadata
      };
    })
  );

  try {
    const samples = await Promise.all(
      Array.from(selectedIds).map(async (calendarId) =>
        adapter.fetchUpcomingEvents(payload.tokens, calendarId)
      )
    );

    validationState = {
      status: 'success',
      checkedAt: now.toISOString(),
      samples: samples.map((sample) => ({
        calendarId: sample.calendarId,
        total: sample.total,
        from: sample.from,
        to: sample.to
      }))
    };

    status = 'validated';
    lastValidatedAt = now;
  } catch (error) {
    validationState = {
      status: 'error',
      checkedAt: now.toISOString(),
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
    status = 'pending_validation';
      lastValidatedAt = null;
  }

  const updatedConfig = toConnectorConfig(
    parsed.type,
    payload,
    entry.scopes,
    Array.from(selectedIds),
    validationState
  );
  const updatedConfigJson = toJsonValue(updatedConfig) as Prisma.InputJsonValue;

  const updatedConnector = await deps.connectors.updateValidation({
    id: connector.id,
    status,
    lastValidatedAt,
    config: updatedConfigJson
  });

  await deps.auditLogs.create({
    actorId: admin.id,
    action: 'connector.created',
    entityType: 'connector',
    entityId: updatedConnector.id,
    metadata: {
      provider,
      calendarCount: calendars.length
    }
  });

  const responsePayload = {
    ...updatedConnector,
    calendars
  };

  const parsedConfig = ConnectorConfigSchema.safeParse(updatedConnector.configJson);

  await queueConnectorValidationJob(
    deps.prisma,
    updatedConnector.id,
    calendars.map((calendar) => calendar.id),
    now
  );

  return ConnectorResponseSchema.parse({
    id: responsePayload.id,
    type: responsePayload.type,
    displayName: responsePayload.displayName,
    status: responsePayload.status,
    lastValidatedAt: responsePayload.lastValidatedAt?.toISOString() ?? null,
    calendars: calendars.map((calendar) => ({
      id: calendar.id,
      providerCalendarId: calendar.providerCalendarId,
      displayName: calendar.displayName,
      privacyMode: calendar.privacyMode,
      metadata: calendar.metadata as Record<string, unknown>
    })),
    config: parsedConfig.success ? parsedConfig.data : undefined,
    createdAt: responsePayload.createdAt.toISOString(),
    updatedAt: responsePayload.updatedAt.toISOString()
  });
}

export async function listConnectors(
  ownerId: string,
  deps: ConnectorServiceDependencies
): Promise<ConnectorResponse[]> {
  const connectors = await deps.connectors.listByOwner(ownerId);

  const results = await Promise.all(
    connectors.map(async (connector) => {
      const calendars = await deps.calendars.listByConnector(connector.id);

      let config: ConnectorConfig | undefined;
      const parsedConfig = ConnectorConfigSchema.safeParse(connector.configJson);
      if (parsedConfig.success) {
        config = parsedConfig.data;
      }

      return ConnectorResponseSchema.parse({
        id: connector.id,
        type: connector.type,
        displayName: connector.displayName,
        status: connector.status,
        lastValidatedAt: connector.lastValidatedAt?.toISOString() ?? null,
        calendars: calendars.map((calendar) => ({
          id: calendar.id,
          providerCalendarId: calendar.providerCalendarId,
          displayName: calendar.displayName,
          privacyMode: calendar.privacyMode,
          metadata: calendar.metadata as Record<string, unknown>
        })),
        config: config ?? undefined,
        createdAt: connector.createdAt.toISOString(),
        updatedAt: connector.updatedAt.toISOString()
      });
    })
  );

  return results;
}
