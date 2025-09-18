# Requirements
## Functional Requirements
1. **FR1**: SynCal must allow users to connect multiple Google Workspace and Microsoft 365 calendars via OAuth, HTML/ICS feed links, or IMAP credentials, storing all tokens and secrets encrypted.
2. **FR2**: The system must sync future events across all linked calendars, applying create, update, reschedule, and delete operations bidirectionally with idempotent handling.
3. **FR3**: Users must be able to configure the priority order and enable/disable switches for each connector type, with the sync engine automatically failing over according to that list.
4. **FR4**: For every mirrored event, users must be able to choose between preserving the original title or replacing it with a generic “Busy” label on a per-calendar basis.
5. **FR5**: The Next.js + ShadCN portal must surface real-time connector status, last sync timestamps, events processed/failed counts, active fallback mode, and pending token expirations.
6. **FR6**: During connector setup, the portal must run validation tests (e.g., ping HTML/ICS URL, test IMAP login, simulate OAuth callback) and display pass/fail feedback before activation.
7. **FR7**: The sync worker must process future events for an adjustable window (default 30 days, including the option to disable limits), running batches without pause unless throttling occurs, at which point exponential backoff applies.
8. **FR8**: The system must maintain an auditable mapping store tracking source event IDs, mirrored event IDs, connectors used, and last sync outcomes to support reconciliation.
9. **FR9**: When a user removes a calendar, the portal must prompt whether to delete mirrored events from that calendar or retain them before completing the removal.
10. **FR10**: The portal must enforce authenticated access via a local administrator account created on first launch, protecting all management and API actions.

## Non-Functional Requirements
1. **NFR1**: All stored credentials, tokens, and connector secrets must be encrypted at rest and never written to plaintext logs; audit trails must redact sensitive fields.
2. **NFR2**: Average end-to-end sync latency for new or updated events must remain under two minutes during normal operation.
3. **NFR3**: Sync reliability must achieve at least 95% successful lifecycle operations per week, with automated alerting when thresholds are breached.
4. **NFR4**: The worker must handle provider throttling gracefully using exponential backoff capped at 30 minutes before surfacing an error state.
5. **NFR5**: Respect provider quotas and HTTP 429 semantics; apply jittered exponential backoff and adaptive throttling when sustained.
6. **NFR6**: Deployment must be reproducible using a single `docker compose up` command with documented environment variables and defaults.
7. **NFR7**: The portal UX must guide users through connector setup with self-explanatory instructions and inline validation, minimizing reliance on external documentation.
8. **NFR8**: Observability must include structured logs, health checks, and Prometheus-compatible metrics endpoints.
9. **NFR9**: The codebase must follow the monorepo structure (`apps/web`, `apps/api`, `apps/worker`, shared packages) and include automated tests covering the sync engine, connector validation, and privacy toggles.
