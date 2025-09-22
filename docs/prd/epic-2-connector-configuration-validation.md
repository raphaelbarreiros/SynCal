# Epic 2 – Connector Configuration & Validation
**Goal**: Implement all connector pathways (OAuth, HTML/ICS, IMAP, self-managed OAuth) with encryption, validation, and management UI so admins can prepare reliable sync sources.

## Story 2.1 Google & Microsoft OAuth Connector Flow
As an administrator,
I want to authorize Google and Microsoft calendars via OAuth,
so that SynCal can sync events with minimal manual setup.

Acceptance Criteria:
1. Connector wizard offers Google and Microsoft options with scope descriptions and consent instructions.
2. Completing OAuth stores encrypted access/refresh tokens plus calendar metadata in Postgres.
3. Wizard allows selecting one or more calendars discovered via API and records their IDs.
4. Post-setup validation fetches upcoming events to confirm API connectivity and displays success/failure feedback.

### Story Draft Validation
- Quick Summary: NEEDS REVISION (clarity 8/10). Add explicit OAuth callback routes in the API spec and clarify validation trigger (sync vs async job).
- Technical Guidance: PARTIAL — Specify callbacks (e.g., `/auth/google/callback`, `/auth/microsoft/callback`) consistent with `.env.example`; define whether validation runs immediately or via queued job with status polling.
- References: Link `docs/prd/provider-credentials-setup.md` (scopes/redirect URIs) and `docs/architecture/security.md` (encrypted secret storage & audit).
- Testing Guidance: Use provider stubs to cover: successful consent/callback, token exchange error, expired/invalid code, and “fetch upcoming events” success/failure.

## Story 2.2 HTML/ICS Feed Connector
As an administrator,
I want to link read-only HTML/ICS calendar feeds,
so that SynCal can ingest events when OAuth is unavailable.

Acceptance Criteria:
1. Setup form accepts feed URL, optional auth header/token, and target calendar label.
2. Submission fetches the feed, validates HTTP 200, parses iCal data, and previews five upcoming events.
3. Validation errors (401/403/network/parse) display actionable messages and block saving until resolved.
4. Connector list shows masked URL, last successful fetch timestamp, and current status badge.

### Story Draft Validation
- Quick Summary: READY (clarity 8.5/10). Choose parser and outline RRULE/timezone expectations; clarify sync vs async validation.
- Technical Guidance: PARTIAL — Specify ICS parser (e.g., ical.js/ics), minimum recurrence/zone handling, request timeout/retry policy; store optional auth header in encrypted fields.
- References: `docs/architecture/security.md` (secrets/log redaction); `docs/architecture/test-strategy-and-standards.md` (integration testing approach).
- Testing Guidance: Cases: 200 valid feed (preview 5 events), 401/403, network error/timeout, malformed ICS, recurrence/timezone sample.

## Story 2.3 IMAP Invite Parsing Connector
As an administrator,
I want SynCal to read meeting invites from an IMAP mailbox,
so that forwarded invites can drive sync when OAuth is blocked.

Acceptance Criteria:
1. Setup captures IMAP host, port, SSL flag, username, password/app password, and mailbox folder.
2. “Test connection” logs in, scans the last 10 messages for `.ics` attachments, parses them, and reports success or detailed failure.
3. Credentials store encrypted; background health checks verify connectivity hourly and record repeated failures.
4. Connector settings show last successful poll and recent errors with remediation tips.

### Story Draft Validation
- Quick Summary: READY (clarity 8.5/10). Specify IMAP lib and validation endpoint semantics.
- Technical Guidance: PARTIAL — Choose IMAP client lib; define timeout/retry, folder selection, TLS options; reuse ICS parser; encrypt credentials; persist `last_validated_at` and repeated failures for status badges.
- References: `docs/architecture/security.md` for encryption/log redaction; DB schema fields (`connectors.status`, `last_validated_at`).
- Testing Guidance: Cover: successful login + parse last 10 messages; bad credentials; TLS failure; empty mailbox; non-ICS attachments; hourly health failure accumulation.

## Story 2.4 Connector Encryption & Secret Management
As an engineer,
I want all connector secrets stored securely,
so that leaked environment files or logs do not expose sensitive data.

Acceptance Criteria:
1. Encryption module uses libsodium/Node crypto with master key provided via environment variable.
2. Sensitive fields (tokens, IMAP password, feed headers) persist encrypted and never appear in plaintext logs.
3. Secrets decrypt only in-memory during connector operations; audit log records accessor, timestamp, and purpose.
4. Automated tests verify encryption round-trip and ensure missing master key blocks startup with a clear error message.

### Story Draft Validation
- Quick Summary: READY (clarity 9/10). Ensure key management and logging redaction requirements are explicit in acceptance.
- Technical Guidance: PASS — Use `ENCRYPTION_KEY` (base64 via the shared helper in `packages/config/src/index.ts`) from env; prefer libsodium sealed box or Node crypto with AEAD (AES‑256‑GCM). Centralize crypto in `packages/config` and consume via helpers; audit access events.
- References: `docs/architecture/security.md#secrets-management` and `.env.example` keys; log redaction guidance under Security.
- Testing Guidance: Unit: encrypt/decrypt round‑trip; tamper ciphertext → fail; missing/short key → startup error. Integration: ensure secrets never appear in logs; audit entries on access.

## Story 2.5 Fallback Priority & Connector Management UI
As an administrator,
I want to order and toggle connectors per calendar,
so that SynCal can fail over according to my preferences.

Acceptance Criteria:
1. Calendar detail view lists connectors with drag-and-drop ordering and enable/disable toggles.
2. UI prevents duplicate connector types for the same calendar pair unless intentionally allowed.
3. Changes persist to Postgres and reflect in API responses immediately.
4. Success and error toasts confirm updates; validation failures provide actionable messaging.

### Story Draft Validation
- Quick Summary: READY (clarity 8.5/10). Clarify API contracts for ordering/toggles and validation rules.
- Technical Guidance: PARTIAL — Persist ordering via `POST /pairs` (UpsertPairRequest) using `fallbackOrder` array; enable/disable via `PATCH /connectors/{id}` updating `status` (`validated`/`disabled`). Prevent duplicate connector types per pair in server validation.
- References: `docs/architecture/rest-api-spec.md` (pairs, connectors); UI spec components (ConnectorList, ValidationAlert).
- Testing Guidance: E2E: drag reorder → saved → refresh reflects order; toggle disable → API PATCH → UI status updates; server rejects invalid duplicates; optimistic UI handles API failures.

## Story 2.6 Connector Summary Dashboard Cards
As an administrator,
I want at-a-glance connector health,
so that I can spot setup issues quickly.

Acceptance Criteria:
1. Dashboard cards show counts of active, warning, and error connectors per type.
2. Clicking a card filters the connectors list accordingly.
3. Status badges derive from last validation and update via polling or websockets.
4. Cards render with accessible contrast in both themes.

### Story Draft Validation
- Quick Summary: READY (clarity 8.5/10). Define how counts are computed and refreshed.
- Technical Guidance: PARTIAL — Derive counts client‑side from `GET /connectors` or add query params for server‑side filtering (optional); refresh via polling or websocket events; ensure badges derive from `status` and `lastValidatedAt`.
- References: UI spec (Dashboard, StatusCard), API spec (connectors list), Security (no sensitive fields in UI).
- Testing Guidance: Unit: status derivation logic; Integration/E2E: cards show correct counts after create/validate/disable; filters apply and persist; accessible contrast verified in both themes.
