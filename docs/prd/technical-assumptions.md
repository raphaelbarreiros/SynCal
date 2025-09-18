# Technical Assumptions
- Languages: TypeScript for web/app/worker services; optional Python modules only if specialized libraries are required.
- Frameworks: Next.js + ShadCN + Tailwind for portal; Node/Express (or Fastify) for API; shared packages for domain logic.
- Data Store: Single Postgres instance (bundled via Docker Compose) for connector state, job queue, mappings, and audit logs.
- Job Scheduling: Worker loop claims jobs using `SELECT ... FOR UPDATE SKIP LOCKED`, with exponential backoff scheduling stored in Postgres.
- Integrations: Google Calendar API v3, Microsoft Graph `Calendars.ReadWrite`, HTML/ICS ingestion, IMAP (RFC 3501) invite parsing, optional Slack notifications (Phase 2).
- Deployment: Docker Compose baseline; optional Helm/Kubernetes manifests later; secrets injected via environment variables.
- Authentication: Local administrator account bootstrap on first launch with hashed credentials; optional OIDC/SSO considered post-MVP.
- Observability: pino/winston structured logging, Prometheus metrics endpoints, health checks for each container.
- CI/CD: GitHub Actions (assumed) running lint (eslint/prettier), unit/integration tests (vitest/jest), and UI smoke tests (Playwright).

## Testing Requirements
- Unit tests for connector validation logic, encryption module, sync window calculations, and privacy transformations.
- Integration tests using mocked Google/Microsoft endpoints to verify create/update/delete flows and fallback ordering.
- End-to-end tests (via Playwright or Cypress) covering admin login, connector setup, validation feedback, and dashboard status changes.
- Manual exploratory checklist for IMAP onboarding and disconnect flows to confirm messaging and cleanup behavior.

## Additional Technical Assumptions and Requests
- Support feature-flag framework (env-based) so Phase 2 capabilities (e.g., Slack status) can be toggled without code removal.
- Ensure all REST endpoints include rate limiting or auth middleware to prevent brute force attempts against admin login.
- Provide JSON schema for backup exports (Phase 2) so future import feature can validate payloads consistently.
