import {
  ConnectorValidationResultSchema,
  ValidateConnectorRequestSchema,
  type ConnectorValidationResult
} from '@syncal/core';
import { createHtmlIcsAdapter } from '@syncal/connectors';
import type { HtmlIcsAdapterOptions } from '@syncal/connectors';

interface ConnectorValidationDependencies extends HtmlIcsAdapterOptions {
  fetch: typeof fetch;
}

export async function validateConnectorConfiguration(
  body: unknown,
  deps: ConnectorValidationDependencies
): Promise<ConnectorValidationResult> {
  const parsed = ValidateConnectorRequestSchema.parse(body);

  const adapter = createHtmlIcsAdapter({
    fetch: deps.fetch,
    timeoutMs: deps.timeoutMs
  });

  const result = await adapter.validate(parsed.config);
  return ConnectorValidationResultSchema.parse(result);
}
