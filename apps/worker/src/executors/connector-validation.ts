import { Prisma } from '@prisma/client';
import { decryptJson } from '@syncal/config';
import {
  ConnectorConfigSchema,
  type ConnectorConfig
} from '@syncal/core';
import type { ConnectorRegistry, OAuthTokens, ProviderProfile } from '@syncal/connectors';
import { z } from 'zod';
import type { JobExecutor, JobExecutionResult } from './sync.js';
import { toJsonValue } from './utils.js';

const PayloadSchema = z.object({
  type: z.literal('connector_validation'),
  connectorId: z.string().min(1),
  calendarIds: z.array(z.string().min(1)).default([])
});

type ConnectorValidationPayload = z.infer<typeof PayloadSchema>;

type SupportedConnectorType = 'google' | 'microsoft';

interface ConnectorCredentials {
  provider: SupportedConnectorType;
  tokens: OAuthTokens;
  profile?: ProviderProfile;
  scopes?: string[];
}

export interface ConnectorValidationExecutorOptions {
  registry: ConnectorRegistry;
  now?: () => Date;
}

function buildFailureResult(summary: string): JobExecutionResult {
  return {
    outcome: 'failure',
    processedEvents: 0,
    failedEvents: 0,
    errorSummary: summary
  } satisfies JobExecutionResult;
}

export function createConnectorValidationExecutor(
  options: ConnectorValidationExecutorOptions
): JobExecutor {
  const nowFactory = options.now ?? (() => new Date());

  return async (job, context) => {
    const parsedPayload = PayloadSchema.safeParse(job.payload);
    if (!parsedPayload.success) {
      const issues = parsedPayload.error.issues.map((issue) => issue.message);
      const summary = `Invalid connector validation payload: ${issues.join(', ')}`;
      context.logger.error({ jobId: job.id, payload: job.payload, summary });
      return buildFailureResult(summary);
    }

    const payload: ConnectorValidationPayload = parsedPayload.data;
    const connector = await context.prisma.connector.findUnique({
      where: { id: payload.connectorId }
    });

    if (!connector) {
      const summary = `Connector ${payload.connectorId} not found`;
      context.logger.error({ jobId: job.id, connectorId: payload.connectorId, summary });
      return buildFailureResult(summary);
    }

    if (connector.type !== 'google' && connector.type !== 'microsoft') {
      const summary = `Unsupported connector type for validation job: ${connector.type}`;
      context.logger.error({ connectorId: connector.id, type: connector.type, summary });
      return buildFailureResult(summary);
    }

    let credentials: ConnectorCredentials;
    try {
      credentials = decryptJson<ConnectorCredentials>(Buffer.from(connector.credentialsEncrypted));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const summary = `Failed to decrypt connector credentials: ${err.message}`;
      context.logger.error({ connectorId: connector.id, error: err }, summary);
      return buildFailureResult(summary);
    }

    if (credentials.provider !== connector.type) {
      const summary = `Credential provider ${credentials.provider} does not match connector type ${connector.type}`;
      context.logger.error({ connectorId: connector.id, summary });
      return buildFailureResult(summary);
    }

    const adapter = options.registry.getAdapter(credentials.provider);
    if (!adapter.fetchUpcomingEvents) {
      const summary = `Connector adapter for ${credentials.provider} does not support validation`; 
      context.logger.error({ connectorId: connector.id, summary });
      return buildFailureResult(summary);
    }

    const configResult = ConnectorConfigSchema.safeParse(connector.configJson);
    if (!configResult.success) {
      const summary = 'Stored connector configuration is invalid';
      context.logger.error({ connectorId: connector.id, issues: configResult.error.issues, summary });
      return buildFailureResult(summary);
    }

    const config = configResult.data as ConnectorConfig;
    const calendarIds = payload.calendarIds.length > 0
      ? payload.calendarIds
      : config.selectedCalendarIds ?? [];

    if (calendarIds.length === 0) {
      const now = nowFactory();
      const validationState: ConnectorConfig['validation'] = {
        status: 'success',
        checkedAt: now.toISOString(),
        samples: []
      };

      const updatedConfig: ConnectorConfig = {
        ...config,
        validation: validationState
      };

      await context.prisma.connector.update({
        where: { id: connector.id },
        data: {
          status: 'validated',
          lastValidatedAt: now,
          configJson: toJsonValue(updatedConfig) as Prisma.InputJsonValue
        }
      });

      context.logger.info(
        { connectorId: connector.id },
        'Connector validation skipped due to empty calendar selection'
      );

      return {
        outcome: 'success',
        processedEvents: 0,
        failedEvents: 0
      } satisfies JobExecutionResult;
    }

    const now = nowFactory();
    const nowIso = now.toISOString();

    try {
      const samples = await Promise.all(
        calendarIds.map((calendarId) =>
          adapter.fetchUpcomingEvents!(credentials.tokens, calendarId)
        )
      );

      const validationState: ConnectorConfig['validation'] = {
        status: 'success',
        checkedAt: nowIso,
        samples: samples.map((sample) => ({
          calendarId: sample.calendarId,
          total: sample.total,
          from: sample.from,
          to: sample.to
        }))
      };

      const updatedConfig: ConnectorConfig = {
        ...config,
        validation: validationState
      };

      await context.prisma.connector.update({
        where: { id: connector.id },
        data: {
          status: 'validated',
          lastValidatedAt: now,
          configJson: toJsonValue(updatedConfig) as Prisma.InputJsonValue
        }
      });

      const processedEvents = samples.reduce((total, sample) => total + sample.total, 0);

      context.logger.info(
        { connectorId: connector.id, calendars: calendarIds.length, processedEvents },
        'Connector validation succeeded'
      );

      return {
        outcome: 'success',
        processedEvents,
        failedEvents: 0
      } satisfies JobExecutionResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const validationState: ConnectorConfig['validation'] = {
        status: 'error',
        checkedAt: nowIso,
        error: err.message
      };

      const updatedConfig: ConnectorConfig = {
        ...config,
        validation: validationState
      };

      await context.prisma.connector.update({
        where: { id: connector.id },
        data: {
          status: 'pending_validation',
          lastValidatedAt: null,
          configJson: toJsonValue(updatedConfig) as Prisma.InputJsonValue
        }
      });

      context.logger.warn(
        { connectorId: connector.id, error: err.message },
        'Connector validation failed'
      );

      return {
        outcome: 'failure',
        processedEvents: 0,
        failedEvents: 0,
        errorSummary: err.message
      } satisfies JobExecutionResult;
    }
  };
}
