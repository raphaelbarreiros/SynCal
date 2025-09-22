import { z } from 'zod';

// Connector types and status enums
export const ConnectorTypeSchema = z.enum(['google', 'microsoft', 'html_ics', 'imap', 'self_managed']);
export const ConnectorStatusSchema = z.enum(['pending_validation', 'validated', 'disabled']);
export const PrivacyModeSchema = z.enum(['original_title', 'busy_placeholder']);

export type ConnectorType = z.infer<typeof ConnectorTypeSchema>;
export type ConnectorStatus = z.infer<typeof ConnectorStatusSchema>;
export type PrivacyMode = z.infer<typeof PrivacyModeSchema>;

// Connector request/response schemas
export const ConnectorCreateRequestSchema = z.object({
  type: ConnectorTypeSchema,
  displayName: z.string().optional(),
  calendars: z.array(z.string()).min(1, 'At least one calendar must be selected'),
  config: z.record(z.string(), z.unknown()).optional()
});

export const OAuthInitiateRequestSchema = z.object({
  provider: z.enum(['google', 'microsoft'])
});

export type ConnectorCreateRequest = z.infer<typeof ConnectorCreateRequestSchema>;
export type OAuthInitiateRequest = z.infer<typeof OAuthInitiateRequestSchema>;

// Calendar schemas
export const CalendarSchema = z.object({
  id: z.string(),
  connectorId: z.string(),
  providerCalendarId: z.string(),
  displayName: z.string().nullable(),
  privacyMode: PrivacyModeSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type Calendar = z.infer<typeof CalendarSchema>;

// Connector schema
export const ConnectorSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  type: ConnectorTypeSchema,
  displayName: z.string().nullable(),
  status: ConnectorStatusSchema,
  lastValidatedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  calendars: z.array(CalendarSchema).optional()
});

export type Connector = z.infer<typeof ConnectorSchema>;

// OAuth response schemas
export const OAuthTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional()
});

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().optional()
});

export const OAuthProviderCalendarSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  primary: z.boolean().optional(),
  accessRole: z.string().optional()
});

export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type OAuthProviderCalendar = z.infer<typeof OAuthProviderCalendarSchema>;

// OAuth initiate response
export const OAuthInitiateResponseSchema = z.object({
  authUrl: z.string(),
  state: z.string()
});

export type OAuthInitiateResponse = z.infer<typeof OAuthInitiateResponseSchema>;