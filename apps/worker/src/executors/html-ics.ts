import { Prisma } from '@prisma/client';
import {
  HtmlIcsConnectorMetadataSchema,
  type HtmlIcsConnectorMetadata
} from '@syncal/core';
import { validateHtmlIcsFeed } from '@syncal/connectors';
import { decryptJson } from '@syncal/config';
import type { JobExecutor, JobExecutionResult } from './sync.js';
import { toJsonValue } from './utils.js';

interface HtmlIcsCredentials {
  feedUrl: string;
  authHeader?: string | null;
  authToken?: string | null;
}

interface HtmlIcsSyncExecutorOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

function buildDefaultMetadata(nowIso: string): HtmlIcsConnectorMetadata {
  return HtmlIcsConnectorMetadataSchema.parse({
    targetCalendarLabel: 'HTML/ICS Feed',
    validationMetadata: {
      status: 'failed',
      maskedUrl: undefined,
      previewEvents: [],
      lastSuccessfulFetchAt: null,
      issues: []
    },
    fetchCache: undefined
  });
}

export function createHtmlIcsSyncExecutor(options: HtmlIcsSyncExecutorOptions = {}): JobExecutor {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const nowFactory = options.now ?? (() => new Date());

  return async (job, context) => {
    const payload = job.payload as Record<string, unknown> | null;
    if (!payload || payload['type'] !== 'html_ics_sync') {
      context.logger.error({ payload, jobId: job.id }, 'Unsupported payload for html_ics_sync executor');
      return {
        outcome: 'failure',
        processedEvents: 0,
        failedEvents: 0,
        errorSummary: 'Unsupported payload for html_ics_sync executor'
      } satisfies JobExecutionResult;
    }

    const connector = await context.prisma.connector.findUnique({
      where: { id: job.connectorId }
    });

    if (!connector || connector.type !== 'html_ics') {
      return {
        outcome: 'failure',
        processedEvents: 0,
        failedEvents: 0,
        errorSummary: 'HTML/ICS connector not found'
      } satisfies JobExecutionResult;
    }

    const now = nowFactory();
    const nowIso = now.toISOString();

    const metadataParse = HtmlIcsConnectorMetadataSchema.safeParse(connector.configJson);
    const currentMetadata = metadataParse.success
      ? metadataParse.data
      : buildDefaultMetadata(nowIso);

    let credentials: HtmlIcsCredentials;
    try {
      credentials = decryptJson<HtmlIcsCredentials>(Buffer.from(connector.credentialsEncrypted));
    } catch (error) {
      context.logger.error({ err: error }, 'Failed to decrypt connector credentials');
      return {
        outcome: 'failure',
        processedEvents: 0,
        failedEvents: 0,
        errorSummary: 'Unable to decrypt connector credentials'
      } satisfies JobExecutionResult;
    }

    const config = {
      feedUrl: credentials.feedUrl,
      targetCalendarLabel: currentMetadata.targetCalendarLabel,
      ...(credentials.authHeader && credentials.authToken
        ? { authHeader: credentials.authHeader, authToken: credentials.authToken }
        : {})
    };

    const validation = await validateHtmlIcsFeed(config, {
      fetch: fetchImpl,
      timeoutMs,
      nowFactory,
      cache: currentMetadata.fetchCache ?? undefined,
      previousValidation: currentMetadata.validationMetadata
    });

    const succeeded = validation.status === 'ok';
    const previewEvents = succeeded
      ? validation.previewEvents ?? []
      : currentMetadata.validationMetadata.previewEvents ?? [];
    const maskedUrl = validation.maskedUrl ?? currentMetadata.validationMetadata.maskedUrl;
    const lastSuccessfulFetchAtIso = succeeded
      ? validation.lastSuccessfulFetchAt ?? nowIso
      : currentMetadata.validationMetadata.lastSuccessfulFetchAt ?? null;

    const updatedMetadata = HtmlIcsConnectorMetadataSchema.parse({
      targetCalendarLabel: currentMetadata.targetCalendarLabel,
      validationMetadata: {
        status: validation.status,
        maskedUrl,
        previewEvents,
        lastSuccessfulFetchAt: lastSuccessfulFetchAtIso,
        issues: validation.issues
      },
      fetchCache: validation.cacheMetadata ?? currentMetadata.fetchCache
    });

    const nextLastSuccessfulFetchAt = lastSuccessfulFetchAtIso
      ? new Date(lastSuccessfulFetchAtIso)
      : null;

    await context.prisma.connector.update({
      where: { id: connector.id },
      data: {
        status: succeeded ? 'validated' : 'pending_validation',
        lastValidatedAt: now,
        // Prisma client in some environments may lag schema regeneration, so cast to retain compatibility.
        lastSuccessfulFetchAt: nextLastSuccessfulFetchAt,
        configJson: toJsonValue(updatedMetadata) as Prisma.InputJsonValue
      } as Prisma.ConnectorUpdateInput
    });

    if (succeeded) {
      context.logger.info({ previewCount: previewEvents.length }, 'HTML/ICS connector validated');
      return {
        outcome: 'success',
        processedEvents: previewEvents.length,
        failedEvents: 0
      } satisfies JobExecutionResult;
    }

    const summary = validation.issues[0]?.message ?? 'HTML/ICS feed validation failed';
    context.logger.warn({ summary }, 'HTML/ICS connector validation failed');

    return {
      outcome: 'failure',
      processedEvents: 0,
      failedEvents: 0,
      errorSummary: summary
    } satisfies JobExecutionResult;
  };
}
