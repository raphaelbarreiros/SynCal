# Epic 1 – Platform Foundation & Secure Portal
**Goal**: Establish the SynCal skeleton, including Docker Compose stack, Postgres schema, local admin auth, and the initial portal shell, so operators can launch a secure instance that is ready for connector configuration.

## Story 1.1 Bootstrap Project & Docker Stack
As a self-hosting administrator,
I want to run a single `docker compose up` command,
so that the web app, API, worker, and Postgres come online with sensible defaults.

Acceptance Criteria:
1. `docker-compose.yml` defines web, api, worker, and Postgres services with shared network/volumes.
2. `.env.example` lists required variables (DB credentials, JWT secret, initial admin flag) and startup fails fast if any are missing.
3. API performs database migrations on first boot to create core tables (users, calendars, connectors, sync_jobs, audit_log).
4. API `/healthz` and worker heartbeat endpoints respond successfully within 5 seconds of stack start.

### Story Draft Validation
- Quick Summary: READY (clarity 8.5/10). Compose file not yet present; migration tool defined (Prisma); health path documented in API spec.
- Technical Guidance: PASS — Reference `infra/docker-compose.yml` (see docs/architecture/infrastructure-and-deployment.md). Use Prisma for migrations on first boot.
- References: DB schema (docs/architecture/database-schema.md); API `/healthz` (docs/architecture/rest-api-spec.md).
- Testing Guidance: Add smoke: `docker compose up` → API `GET /healthz` < 5s; Postgres reachable; worker logs heartbeat.


## Story 1.2 Local Admin Authentication Setup
As a self-hosting administrator,
I want to create a secure portal login on first launch,
so that only authorized users can manage connectors and calendars.

Acceptance Criteria:
1. Initial boot prompts for admin email/password (via CLI or environment variables) and stores a hashed credential in Postgres.
2. Portal login screen requires authentication before accessing any route; unauthenticated requests redirect to login.
3. Authenticated sessions use secure cookies or JWTs with 24-hour expiration and refresh support.
4. Logout clears the session and unauthenticated API requests return HTTP 401.

### Story Draft Validation
- Quick Summary: READY (clarity 9/10). Add CSRF/session hardening details; define password policy.
- Technical Guidance: PASS — Backed by docs/architecture/security.md (cookie sessions, Argon2). Add cookie name `syn_session`, TTL, refresh behavior.
- References: API `/auth/session` in docs/architecture/rest-api-spec.md; env keys in `.env.example` (`SESSION_SECRET`).
- Testing Guidance: Unit/integration: login 401→204, secure cookie set, logout 204, protected route 401; CSRF protection active.


## Story 1.3 Portal Shell & Navigation
As an administrator,
I want a dashboard layout with navigation scaffolding,
so that I can reach connector, calendar, and settings areas.

Acceptance Criteria:
1. Dashboard renders status tiles (placeholders for connectors, sync jobs, alerts) using ShadCN components with light/dark mode support.
2. Navigation includes Dashboard, Connectors, Calendars, Logs, and Settings links (non-functional stubs allowed initially).
3. Unified calendar panel placeholder displays instructional text when no calendars are connected.
4. Layout is responsive down to 768px width and meets WCAG AA contrast targets in both themes.

### Story Draft Validation
- Quick Summary: READY (clarity 8.5/10). Specify minimal route/file scaffold and a11y checks.
- Technical Guidance: PARTIAL — Call out App Router paths (e.g., `apps/web/src/app/(dashboard)/page.tsx`, `layout.tsx`) and ShadCN components per docs/architecture/front-end-spec.md.
- References: See UI spec sections “Screen Specifications” and “Accessibility Requirements”.
- Testing Guidance: Playwright smoke for nav links render, responsive at 768px, axe scan passes key screens; theme contrast verified.


## Story 1.4 Database Job Queue & Worker Loop Scaffold
As an engineer,
I want a Postgres-based job queue for the worker,
so that future sync tasks can run without extra infrastructure.

Acceptance Criteria:
1. `sync_jobs` table stores job id, calendar id, connector type, payload, status, tries, next_run_at, and last_error.
2. Worker claims jobs with `SELECT ... FOR UPDATE SKIP LOCKED`, marks them `in_progress`, and releases them on completion.
3. Failed jobs increment `tries`, compute next retry timestamp using exponential backoff (capped at 30 minutes), and remain queued.
4. Jobs are schedulable for testing via the standard `POST /jobs/schedule` endpoint (admin-authenticated) and/or a local dev script (e.g., `scripts/seed.ts`).

### Story Draft Validation
- Quick Summary: READY (clarity 9/10). Use the standard schedule route; no dedicated seed endpoint.
- Technical Guidance: PASS — Matches docs/architecture/database-schema.md (`sync_jobs`, SKIP LOCKED). Note `max_retries=5` and 30m cap.
- References: Use `POST /jobs/schedule` from docs/architecture/rest-api-spec.md; optional local script `scripts/seed.ts` may call this.
- Testing Guidance: Integration tests for concurrent claim/release, retry/backoff schedule (1m→2m→4m…≤30m), idempotent completion.
