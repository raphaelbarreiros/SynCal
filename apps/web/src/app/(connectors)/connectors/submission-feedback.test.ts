import { describe, expect, it } from 'vitest';
import type { ConnectorResponse } from '@syncal/core';

import { deriveConnectorSubmissionFeedback } from './submission-feedback.js';

function buildConnector(overrides: Partial<ConnectorResponse> = {}): ConnectorResponse {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'google',
    displayName: null,
    status: 'pending_validation',
    lastValidatedAt: null,
    calendars: [],
    config: undefined,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides
  } satisfies ConnectorResponse;
}

describe('deriveConnectorSubmissionFeedback', () => {
  it('returns a success message when validation completes', () => {
    const connector = buildConnector({
      displayName: 'Marketing',
      status: 'validated',
      config: {
        provider: 'google',
        validation: {
          status: 'success',
          checkedAt: '2025-01-01T01:00:00.000Z'
        }
      }
    });

    const result = deriveConnectorSubmissionFeedback(connector);

    expect(result.successMessage).toBe('Connector Marketing is ready.');
    expect(result.errorMessage).toBeUndefined();
  });

  it('surfaces a validation error with actionable guidance', () => {
    const connector = buildConnector({
      status: 'pending_validation',
      config: {
        provider: 'google',
        validation: {
          status: 'error',
          checkedAt: '2025-01-01T01:00:00.000Z',
          error: 'Calendar fetch failed'
        }
      }
    });

    const result = deriveConnectorSubmissionFeedback(connector);

    expect(result.successMessage).toBeUndefined();
    expect(result.errorMessage).toBe(
      'Validation failed: Calendar fetch failed. Check OAuth credentials, ensure the selected calendars remain accessible, and retry validation from the connectors table.'
    );
  });

  it('returns a descriptive message for validated HTML/ICS connectors', () => {
    const connector = buildConnector({
      type: 'html_ics',
      status: 'validated',
      targetCalendarLabel: 'Ops Calendar',
      maskedUrl: 'https://calendar.example.com/…/feed.ics',
      previewEvents: [
        {
          uid: 'evt-1',
          summary: 'Standup',
          startsAt: '2026-01-01T14:00:00.000Z',
          allDay: false
        }
      ]
    });

    const result = deriveConnectorSubmissionFeedback(connector);

    expect(result.successMessage).toBe('Connector Ops Calendar feed validated. 1 previewed event available.');
    expect(result.errorMessage).toBeUndefined();
  });

  it('returns the first validation issue for HTML/ICS connectors that failed validation', () => {
    const connector = buildConnector({
      type: 'html_ics',
      status: 'pending_validation',
      validationIssues: [
        {
          code: 'HTTP_401',
          message: 'Authentication failed for the provided header/token.',
          severity: 'error'
        }
      ]
    });

    const result = deriveConnectorSubmissionFeedback(connector);

    expect(result.successMessage).toBeUndefined();
    expect(result.errorMessage).toBe('Authentication failed for the provided header/token.');
  });
});
