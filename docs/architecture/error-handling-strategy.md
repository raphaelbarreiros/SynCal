## Error Handling Strategy

### General Approach
- **Error Model:** Typed error objects extending a shared `AppError` base with code, message, and metadata for logging.
- **Exception Hierarchy:** `AppError` → domain-specific subclasses (`AuthError`, `ValidationError`, `SyncFailure`, `ExternalServiceError`).
- **Error Propagation:** Throw typed errors within services; Fastify error handler maps to HTTP responses; worker catches and logs, updating job status and retry metadata.

### Logging Standards
- **Library:** pino 9.10.0 with pino-http integration.
- **Format:** JSON lines with RFC3339 timestamps.
- **Levels:** trace (dev only), debug, info, warn, error, fatal.
- **Required Context:**
  - Correlation ID: `req.id` (Fastify) or generated UUID per job.
  - Service Context: `service` field (`api`, `worker`, `portal`).
  - User Context: Admin user id/email only when authenticated; never include secrets.

### Error Handling Patterns
#### External API Errors
- **Retry Policy:** Exponential backoff (1, 2, 4, 8, 16 minutes, capped at 30) with max retries configurable per connector.
- **Circuit Breaker:** Trip after 5 consecutive provider failures; pause job scheduling and surface alert.
- **Timeout Configuration:** HTTP requests default 15s timeout with abort controller; IMAP/ICS fetch limited to 30s.
- **Error Translation:** Map provider error codes to normalized `ExternalServiceError` with user-friendly summary and technical detail in metadata.

#### Provider Quotas & 429 Handling
- **HTTP 429 / Quota Exceeded:** Treat as retriable with exponential backoff; jitter retry times to avoid thundering herd.
- **Backoff Caps:** Respect provider guidance where available; otherwise cap at 30 minutes with max 5 retries before surfacing an alert.
- **Adaptive Throttling:** Track recent 429s per provider/account and reduce concurrency accordingly.
- **Token/Consent Issues:** Differentiate 401/403 (auth/consent problems) from 429; prompt admin via alerts for the former.
- **Documentation:** Note quota types and typical limits for Google Calendar and Microsoft Graph in PRD; link to provider docs.

#### Business Logic Errors
- **Custom Exceptions:** `ValidationError`, `PrivacyConflictError`, `ConfigurationError` thrown when domain invariants break.
- **User-Facing Errors:** API responds with JSON `{ code, message, details? }` and appropriate HTTP status.
- **Error Codes:** Namespaced string codes (e.g., `AUTH.INVALID_CREDENTIALS`, `CONNECTOR.VALIDATION_FAILED`).

#### Data Consistency
- **Transaction Strategy:** Use Prisma transactions for multi-table operations (connectors + calendars, mapping updates); wrap in `prisma.$transaction` with SERIALIZABLE isolation for critical writes.
- **Compensation Logic:** Worker records partial failures and queues clean-up job if mirrored event updates partially succeed.
- **Idempotency:** Enforced via unique constraint on `(source_calendar_id, source_event_id)` and job deduplication; API endpoints accept `Idempotency-Key` header for scheduling requests.

