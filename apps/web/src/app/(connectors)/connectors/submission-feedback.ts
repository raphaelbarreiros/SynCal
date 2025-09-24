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
  if (connector.type === 'html_ics') {
    const label = connector.targetCalendarLabel?.trim() || connectorLabel(connector);

    if (connector.status === 'validated') {
      const previewCount = connector.previewEvents?.length ?? 0;
      const previewDetail = previewCount
        ? ` ${previewCount} previewed event${previewCount === 1 ? '' : 's'} available.`
        : '';

      return {
        successMessage: `Connector ${label} feed validated.${previewDetail}`.trim()
      };
    }

    const issueMessage = connector.validationIssues?.[0]?.message;
    return {
      errorMessage:
        issueMessage ??
        'Connector was created but still requires validation. Test the feed and retry from the connector list.'
    };
  }

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
