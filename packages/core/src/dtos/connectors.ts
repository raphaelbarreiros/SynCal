import { z } from 'zod';

export const ConnectorTypeSchema = z.enum([
  'google',
  'microsoft',
  'html_ics',
  'imap',
  'self_managed'
]);
export type ConnectorType = z.infer<typeof ConnectorTypeSchema>;

export const OAuthProviderSchema = z.enum(['google', 'microsoft']);
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

export const ConnectorStatusSchema = z.enum([
  'pending_validation',
  'validated',
  'disabled'
]);
export type ConnectorStatus = z.infer<typeof ConnectorStatusSchema>;

export const PrivacyModeSchema = z.enum(['original_title', 'busy_placeholder']);
export type PrivacyMode = z.infer<typeof PrivacyModeSchema>;

export const StartOAuthRequestSchema = z.object({
  provider: OAuthProviderSchema
});
export type StartOAuthRequest = z.infer<typeof StartOAuthRequestSchema>;

export const StartOAuthResponseSchema = z.object({
  provider: OAuthProviderSchema,
  authorizationUrl: z.string().url(),
  state: z.string().min(16)
});
export type StartOAuthResponse = z.infer<typeof StartOAuthResponseSchema>;

export const DiscoveredCalendarSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  timeZone: z.string().optional(),
  isPrimary: z.boolean(),
  canEdit: z.boolean()
});
export type DiscoveredCalendar = z.infer<typeof DiscoveredCalendarSchema>;

export const OAuthContextEntrySchema = z.object({
  provider: OAuthProviderSchema,
  state: z.string().min(16),
  profile: z
    .object({
      id: z.string(),
      email: z.string().optional(),
      name: z.string().optional()
    })
    .optional(),
  scopes: z.array(z.string()).optional(),
  discoveredCalendars: z.array(DiscoveredCalendarSchema).default([])
});
export type OAuthContextEntry = z.infer<typeof OAuthContextEntrySchema>;

export const OAuthContextResponseSchema = z.object({
  entries: z.array(OAuthContextEntrySchema)
});
export type OAuthContextResponse = z.infer<typeof OAuthContextResponseSchema>;

export const CalendarSelectionSchema = z.object({
  providerCalendarId: z.string(),
  displayName: z.string().optional(),
  privacyMode: PrivacyModeSchema.default('busy_placeholder')
});
export type CalendarSelection = z.infer<typeof CalendarSelectionSchema>;

export const HtmlIcsConnectorConfigSchema = z
  .object({
    feedUrl: z
      .string()
      .url()
      .refine((value) => value.startsWith('https://'), {
        message: 'Feed URL must use HTTPS'
      }),
    authHeader: z.string().min(1).optional(),
    authToken: z.string().min(1).optional(),
    targetCalendarLabel: z.string().min(1)
  })
  .superRefine((value, ctx) => {
    if ((value.authHeader && !value.authToken) || (!value.authHeader && value.authToken)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Auth header name and token must both be provided',
        path: value.authHeader ? ['authToken'] : ['authHeader']
      });
    }
  });
export type HtmlIcsConnectorConfig = z.infer<typeof HtmlIcsConnectorConfigSchema>;

const OAuthCreateConnectorRequestSchema = z.object({
  type: OAuthProviderSchema,
  state: z.string().min(16),
  displayName: z.string().optional(),
  selectedCalendars: z.array(CalendarSelectionSchema).min(1)
});

const HtmlIcsCreateConnectorRequestSchema = z.object({
  type: z.literal('html_ics'),
  displayName: z.string().optional(),
  config: HtmlIcsConnectorConfigSchema
});

export const CreateConnectorRequestSchema = z.discriminatedUnion('type', [
  OAuthCreateConnectorRequestSchema,
  HtmlIcsCreateConnectorRequestSchema
]);
export type CreateConnectorRequest = z.infer<typeof CreateConnectorRequestSchema>;

export const ConnectorCalendarSchema = z.object({
  id: z.string().uuid(),
  providerCalendarId: z.string(),
  displayName: z.string().nullable(),
  privacyMode: PrivacyModeSchema,
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type ConnectorCalendar = z.infer<typeof ConnectorCalendarSchema>;

export const ConnectorValidationSampleSchema = z.object({
  calendarId: z.string(),
  total: z.number().int().nonnegative(),
  from: z.string(),
  to: z.string()
});
export type ConnectorValidationSample = z.infer<typeof ConnectorValidationSampleSchema>;

export const ConnectorValidationStateSchema = z.object({
  status: z.enum(['pending', 'success', 'error']),
  checkedAt: z.string().optional(),
  samples: z.array(ConnectorValidationSampleSchema).optional(),
  error: z.string().optional()
});
export type ConnectorValidationState = z.infer<typeof ConnectorValidationStateSchema>;

export const ConnectorConfigSchema = z
  .object({
    provider: OAuthProviderSchema,
    profile: z
      .object({
        id: z.string(),
        email: z.string().optional(),
        name: z.string().optional()
      })
      .optional(),
    scopes: z.array(z.string()).optional(),
    discoveredCalendars: z.array(DiscoveredCalendarSchema).optional(),
    selectedCalendarIds: z.array(z.string()).optional(),
    validation: ConnectorValidationStateSchema.optional()
  })
  .passthrough();
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>;

export const ConnectorResponseSchema = z.object({
  id: z.string().uuid(),
  type: ConnectorTypeSchema,
  displayName: z.string().nullable(),
  status: ConnectorStatusSchema,
  lastValidatedAt: z.string().nullable().optional(),
  calendars: z.array(ConnectorCalendarSchema).default([]),
  config: ConnectorConfigSchema.optional(),
  maskedUrl: z.string().optional(),
  lastSuccessfulFetchAt: z.string().nullable().optional(),
  previewEvents: z
    .array(
      z.object({
        uid: z.string(),
        summary: z.string().optional(),
        startsAt: z.string(),
        endsAt: z.string().optional(),
        allDay: z.boolean().default(false)
      })
    )
    .optional(),
  targetCalendarLabel: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ConnectorResponse = z.infer<typeof ConnectorResponseSchema>;

export const ConnectorListResponseSchema = z.object({
  connectors: z.array(ConnectorResponseSchema)
});
export type ConnectorListResponse = z.infer<typeof ConnectorListResponseSchema>;

export const ValidationEventPreviewSchema = z.object({
  uid: z.string(),
  summary: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  allDay: z.boolean().default(false)
});
export type ValidationEventPreview = z.infer<typeof ValidationEventPreviewSchema>;

export const ValidationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'warning', 'error']).default('error')
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const HtmlIcsConnectorMetadataSchema = z.object({
  targetCalendarLabel: z.string(),
  maskedUrl: z.string().optional(),
  previewEvents: z.array(ValidationEventPreviewSchema).default([]),
  lastSuccessfulFetchAt: z.string().nullable().optional(),
  validationIssues: z.array(ValidationIssueSchema).default([]),
  validationStatus: z.enum(['ok', 'failed']).optional()
});
export type HtmlIcsConnectorMetadata = z.infer<typeof HtmlIcsConnectorMetadataSchema>;

export const ConnectorValidationResultSchema = z.object({
  status: z.enum(['ok', 'failed']),
  maskedUrl: z.string().optional(),
  previewEvents: z.array(ValidationEventPreviewSchema).optional(),
  lastSuccessfulFetchAt: z.string().optional(),
  issues: z.array(ValidationIssueSchema).default([])
});
export type ConnectorValidationResult = z.infer<typeof ConnectorValidationResultSchema>;

export const ValidateConnectorRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('html_ics'),
    config: HtmlIcsConnectorConfigSchema
  })
]);
export type ValidateConnectorRequest = z.infer<typeof ValidateConnectorRequestSchema>;
