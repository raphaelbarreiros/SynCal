import {
  ConnectorValidationResultSchema,
  ValidateConnectorRequestSchema,
  type ConnectorValidationResult
} from '@syncal/core';
import { validateHtmlIcsFeed } from '@syncal/connectors';
import type { HtmlIcsAdapterOptions } from '@syncal/connectors';

interface ConnectorValidationDependencies extends HtmlIcsAdapterOptions {
  fetch: typeof fetch;
}

export async function validateConnectorConfiguration(
  body: unknown,
  deps: ConnectorValidationDependencies
): Promise<ConnectorValidationResult> {
  const parsed = ValidateConnectorRequestSchema.parse(body);

  const result = await validateHtmlIcsFeed(parsed.config, {
    fetch: deps.fetch,
    timeoutMs: deps.timeoutMs ?? 30_000,
    nowFactory: deps.now ?? (() => new Date())
  });
  return ConnectorValidationResultSchema.parse(result);
}
