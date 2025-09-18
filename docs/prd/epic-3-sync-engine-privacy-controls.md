# Epic 3 – Sync Engine & Privacy Controls
**Goal**: Execute end-to-end synchronization, ensuring updates, deletes, and privacy preferences apply consistently while handling throttling and calendar removal choices.

## Story 3.1 Sync Window & Initial Mirror
As an administrator,
I want SynCal to sync future events over a configurable window,
so that calendars stay aligned without manual intervention.

Acceptance Criteria:
1. Settings allow adjusting the sync window (default 30 days, min 1, max 365, plus “no limit”).
2. Worker schedules jobs per calendar/day reflecting the configured window.
3. Initial sync pulls source events, creates mirrored events through provider APIs, and stores mapping IDs.
4. Measured latency from source creation to mirror remains under two minutes in staging tests with default window.

### Story Draft Validation
- Quick Summary: READY (clarity 8.5/10). Clarify scheduling granularity and window edge rules; note performance measurement method.
- Technical Guidance: PARTIAL — Define job granularity (e.g., per calendar/day) and window boundaries (inclusive start/exclusive end). Use `POST /jobs/schedule` to enqueue work; ensure worker reads config for default window and “no limit”. Persist mappings in `event_mappings`.
- References: `docs/architecture/database-schema.md` (sync_jobs, event_mappings), `docs/architecture/test-strategy-and-standards.md` (integration perf tests).
- Testing Guidance: Integration: mirror only events inside window; boundary tests at start/end; latency < 2 minutes with default window; metrics recorded.

## Story 3.2 Update & Delete Handling with Idempotency
As a user,
I want updates and cancellations to propagate automatically,
so that mirrored calendars stay accurate.

Acceptance Criteria:
1. Mapping store tracks source UID, mirrored event ID, last modified timestamps, and connector used.
2. Source updates trigger mirrored updates; reruns remain idempotent without duplicates.
3. Source deletions or cancellations remove mirrored events unless “keep copies” was chosen.
4. Tests cover double-processing and conflicting updates where the most recent change wins.

### Story Draft Validation
- Quick Summary: READY (clarity 9/10). Ensure mapping uniqueness and conflict resolution are explicit.
- Technical Guidance: PASS — Deduplicate by (source_calendar_id, source_event_id); store last modified timestamps; on reruns, upsert mirrored events idempotently; resolve conflicts by most recent `lastModified`.
- References: `docs/architecture/database-schema.md#event_mappings` for keys and timestamps.
- Testing Guidance: Simulate duplicate processing; concurrent updates; delete vs update race; verify no duplicate mirrors and correct winner.

## Story 3.3 Privacy Title Toggle
As an administrator,
I want mirrored events to show “Busy” when desired,
so that sensitive details remain private.

Acceptance Criteria:
1. Calendar settings include toggle between “Keep titles” and “Replace with Busy” (default Busy).
2. Busy mode ensures mirrored events omit title, description, and location beyond generic placeholders.
3. Changing the toggle retroactively updates upcoming mirrored events on the next sync run.
4. Portal clearly labels each calendar’s current privacy mode.

### Story Draft Validation
- Quick Summary: READY (clarity 9/10). Specify exact fields redacted in Busy mode.
- Technical Guidance: PASS — When `busy_placeholder`, set title to “Busy”, remove/obfuscate description/location; enforce in worker write path and UI rendering; retroactive apply to upcoming events on next run; log redaction consistent with Security.
- References: `docs/architecture/security.md#data-protection` (logging restrictions), API `Calendar.privacyMode`.
- Testing Guidance: Toggle → upcoming mirrors updated; revert toggle → titles restored from source; logs never contain private fields in Busy mode.

## Story 3.4 Rate Limit & Error Backoff
As an engineer,
I want the sync worker to handle throttling gracefully,
so that provider limits do not derail operation.

Acceptance Criteria:
1. Worker detects 429/503 responses and retries with exponential backoff (1m, 2m, 4m, capped at 30m).
2. Backoff scheduling stored in `sync_jobs` so the dashboard can show “Retrying in X minutes.”
3. After max retries, job status becomes `error` with surfaced reason; metrics increment failure counters for alerts.
4. Successful completion resets retry counters and clears backoff state.

### Story Draft Validation
- Quick Summary: READY (clarity 9/10). Consider jitter to avoid thundering herds.
- Technical Guidance: PASS — Detect 429/503; compute exponential backoff (1m→2m→4m… ≤30m) with small jitter; persist `next_run_at`, `retry_count`; after max retries set status `error` and record `last_error`; on success reset counters.
- References: `docs/architecture/database-schema.md#sync_jobs`; Metrics in `docs/architecture/rest-api-spec.md#metrics`.
- Testing Guidance: Simulate throttling; verify scheduled `next_run_at` progression and cap; ensure metrics increment; success clears backoff.

## Story 3.5 Calendar Removal Safeguard
As an administrator,
I want to remove a calendar safely,
so that mirrored events are cleaned up according to my choice.

Acceptance Criteria:
1. Removal flow prompts “Delete mirrored events” vs “Keep mirrored events” with explanatory copy.
2. Choosing delete queues cleanup jobs that remove mirrored events before deleting mappings.
3. Choosing keep preserves mappings for audit but disables further sync activity.
4. Confirmation toast and audit log entry capture the user, time, and choice.

### Story Draft Validation
- Quick Summary: READY (clarity 9/10). Specify mapping disable semantics when keeping mirrors.
- Technical Guidance: PASS — On “Delete mirrors”, enqueue cleanup jobs before deleting mappings; on “Keep mirrors”, mark mappings disabled/archived to prevent future sync, but keep for audit; guard with auth and double‑confirm.
- References: API `DELETE /calendars/{id}` contract; `audit_logs` in database schema.
- Testing Guidance: Both choices validated; cleanup actually removes mirrors then mappings; keep leaves mirrors and disables further sync; idempotent repeated deletion.

## Story 3.6 Unified Calendar Rendering
As a user,
I want to view a combined calendar in the portal,
so that I can confirm availability at a glance.

Acceptance Criteria:
1. Dashboard calendar renders events aggregated across all connectors, respecting Busy/private labels.
2. Supports month, week, and day views using a lightweight calendar component styled with ShadCN.
3. Filters allow toggling individual calendars/connectors.
4. View updates within one sync cycle when new events process, using polling or websocket updates.

### Story Draft Validation
- Quick Summary: READY (clarity 8.5/10). Define data source for aggregated events.
- Technical Guidance: PARTIAL — Expose an aggregated events endpoint (e.g., `GET /events?start&end&filters`) or reuse an existing API once defined; ensure Busy mode respected; support month/week/day views efficiently; consider pagination/chunking for large ranges.
- References: UI spec (UnifiedCalendar, PrivacyBadge), Security (privacy), potential future API addition.
- Testing Guidance: Render events with filters; verify Busy placeholders; switching views is performant; updates reflected within one sync cycle via polling/websocket.
