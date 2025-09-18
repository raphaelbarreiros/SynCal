# Epic 4 – Unified Dashboard & Observability
**Goal**: Provide confidence and diagnostics once syncing is active through metrics, logs, alerts, and configurable settings.

## Story 4.1 Metrics & Health Endpoints
As an administrator,
I want metrics endpoints for the API and worker,
so that I can monitor performance with standard tooling.

Acceptance Criteria:
1. API exposes `/metrics` (Prometheus format) covering sync counts, failures, queue depth, and backoff durations.
2. Worker exposes heartbeat metrics and per-connector success/failure counters.
3. Health endpoints report DB connectivity and encryption key readiness; failing dependencies return HTTP 503.
4. Documentation includes sample Prometheus scrape configuration.

### Story Draft Validation
- Quick Summary: READY (clarity 9/10). Define core metric names and buckets; align /healthz dependency checks.
- Technical Guidance: PASS — Expose Prometheus metrics via `prom-client` on API and Worker. Include counters/gauges: `sync_jobs_total{status,type}`, `sync_failures_total{connector}`, `queue_depth`, and histograms (e.g., `sync_latency_seconds` with sane buckets). Keep `/healthz` returning 503 when DB or encryption key not ready. Optionally include process metrics.
- References: `docs/architecture/rest-api-spec.md` (`/metrics`, `/healthz`), `docs/architecture/tech-stack.md` (prom-client), Security for dependency exposure details.
- Testing Guidance: Integration: scrape `/metrics` and assert metric presence and labels; kill DB to verify `/healthz` 503; confirm histogram buckets render correctly.

## Story 4.2 Dashboard Status Panels
As a user,
I want the dashboard to show system health,
so that I can confirm SynCal is functioning at a glance.

Acceptance Criteria:
1. Tiles display counts of active calendars, connectors in warning/error, and pending jobs.
2. Token expiry warnings appear when credentials expire within 72 hours.
3. Backoff alerts show countdown timers for jobs in retry state.
4. Tiles link to detailed views with filters pre-applied.

### Story Draft Validation
- Quick Summary: READY (clarity 8.5/10). Specify data sources and refresh behavior.
- Technical Guidance: PARTIAL — Derive counts from `GET /connectors` (status badges) and `GET /jobs?status=...` for pending jobs. Token expiry warnings require storing/deriving expiry timestamps in connector metadata; warn at <72h remaining. Implement polling (e.g., 10–30s) or websockets for updates; links pass query params to filtered pages.
- References: API spec (`/connectors`, `/jobs`), UI spec components (StatusCard), Security (no secrets in UI).
- Testing Guidance: E2E: counts update after connector enable/disable and job insert; token expiry banner appears when threshold crossed; filters persist via URL params; contrast/accessibility verified.

## Story 4.3 Sync Activity Timeline & Log Viewer
As an administrator,
I want to review recent sync activity and errors,
so that I can troubleshoot without shell access.

Acceptance Criteria:
1. Timeline lists recent sync jobs with status, duration, connector, and link to job details.
2. Log viewer fetches structured logs via API with pagination and filters for severity, calendar, and connector.
3. Logs redact sensitive fields but include correlation IDs to match worker/API entries.
4. Export button downloads filtered logs as JSON or CSV.

### Story Draft Validation
- Quick Summary: NEEDS REVISION (clarity 8/10). Define log API contract and redaction guarantees.
- Technical Guidance: PARTIAL — Use structured logging (pino) with correlation IDs (`reqId`/`jobId`). Expose a paginated logs endpoint (e.g., `GET /logs?level=&connectorId=&calendarId=&limit=&cursor=`) or derive timeline from `/jobs` plus a `/jobs/{id}/logs` detail. Ensure sensitive fields are redacted (see Security). Provide CSV/JSON export server-side to avoid client-heavy transforms.
- References: Security logging restrictions; API `/jobs` existing; consider adding `/logs` (spec update) or reuse job logs schema.
- Testing Guidance: Integration/E2E: filter by severity/connector; pagination works; export returns matching subset; redaction verified via negative tests.

## Story 4.4 Alerting & Notifications
As an administrator,
I want to be notified when sync issues persist,
so that I can remediate problems promptly.

Acceptance Criteria:
1. Configurable alert thresholds (e.g., three consecutive failures, OAuth token expired) stored in settings.
2. Notifications delivered via email (SMTP credentials stored securely) and optional webhook/Slack (flagged as Phase 2 integration).
3. Alert history stored in Postgres with acknowledgement workflow for marking resolved.
4. Dashboard highlights active alerts with clear call-to-action.

### Story Draft Validation
- Quick Summary: READY (clarity 8.5/10). Make alert triggers and acknowledgement flows explicit.
- Technical Guidance: PASS — Persist alerts in `alerts` table; create on conditions (e.g., N consecutive failures, expired tokens). Provide endpoints to list/ack (`GET /alerts`, `POST /alerts/{id}/ack`). Notifications: send via SMTP (config via env) and optional webhook; Gmail SMTP supported for small deployments (app passwords). Defer Slack to Phase 2. Store thresholds in settings. Rate-limit repeated notifications.
- References: Database schema (`alerts`), Security (secrets, email), potential Settings.
- Testing Guidance: Simulate threshold breaches → alert created; ack marks resolved and hides panel; email/webhook sent (use MailHog/mock) with retries; alerts list filters by severity and ack state.

## Story 4.5 Settings Management
As an administrator,
I want a settings screen to adjust global behavior,
so that I can tailor SynCal without editing configuration files.

Acceptance Criteria:
1. Settings screen exposes sync window default, theme preference, alert thresholds, and admin password update workflow.
2. Form validation prevents invalid values (e.g., negative windows, weak password).
3. Changes persist immediately and reflect in running services (e.g., updated window reschedules jobs).
4. All actions require admin auth and generate audit log entries.

### Story Draft Validation
- Quick Summary: READY (clarity 9/10). Define persistence model and runtime propagation.
- Technical Guidance: PASS — Persist settings in a `settings` table or key‑value store, surfaced via `GET/PUT /settings`. On update, reflect changes immediately: API reads from DB; Worker polls or subscribes to changes to reschedule jobs (e.g., on sync window update). Enforce validation on server side; write audit log entries for changes.
- References: Audit logs in DB schema; Security for auth; potential new `/settings` endpoints.
- Testing Guidance: Change sync window → worker reschedules; theme pref persisted and applied; alert thresholds affect alerts; password update workflow validated; audit entries recorded; server validation rejects invalid values.
### SLOs & Alert Thresholds (MVP)
- Weekly sync success SLO: ≥95%
- Alerts:
  - Connector: 3 consecutive failures → create alert
  - Token expiry: <72h remaining → warning; expired → error
  - Queue depth: threshold N (configurable) → warning
  - Provider 429 spikes: adaptive throttling engaged; notify if sustained
