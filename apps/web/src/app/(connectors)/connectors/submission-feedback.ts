import type { ConnectorResponse } from '@syncal/core';

export interface SubmissionFeedback {
  successMessage?: string;
  errorMessage?: string;
}

function connectorLabel(connector: ConnectorResponse): string {
  return connector.displayName?.trim() || connector.type;
}

export function deriveConnectorSubmissionFeedback(
  connector: ConnectorResponse
): SubmissionFeedback {
  const validation = connector.config?.validation;

  if (connector.status === 'validated') {
    return {
      successMessage: `Connector ${connectorLabel(connector)} is ready.`
    };
  }

  if (connector.status === 'pending_validation' && validation?.status === 'error') {
    const reason = validation.error?.trim() || 'Validation failed for the selected calendars.';
    return {
      errorMessage: `Validation failed: ${reason}. Check OAuth credentials, ensure the selected calendars remain accessible, and retry validation from the connectors table.`
    };
  }

  return {};
}
