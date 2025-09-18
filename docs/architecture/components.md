## Components

### Portal (Next.js App)
**Responsibility:** Render the administrative UI, guide connector setup, display sync status, and expose configuration workflows.

**Key Interfaces:**
- `REST /api/*` — interacts with API gateway for auth, connectors, calendars, jobs
- `/metrics` read-only view (proxied) — pulls Prometheus summaries for dashboard widgets

**Dependencies:** API service for data and mutations; shared `packages/ui`, `packages/core` for type-safe DTOs.

**Technology Stack:** Next.js 15 App Router, React 19, shadcn, Tailwind CSS, SWR/React Query for data fetching.

### API Service (Fastify)
**Responsibility:** Provide authenticated REST endpoints for connector management, calendar pairing, job scheduling, audit logging, and metrics.

**Key Interfaces:**
- `POST /auth/session`, `DELETE /auth/session` — session lifecycle
- `GET/POST/PUT /connectors` — connector CRUD & validation triggers
- `GET/POST /calendars`, `POST /pairs` — calendar configuration and sync pair management
- `POST /jobs/schedule` — enqueue sync jobs
- `GET /metrics` — Prometheus metrics endpoint

**Dependencies:** PostgreSQL (Prisma client), `packages/core` (domain types), `packages/connectors` (validation harness), session store (signed cookies), pino logger.

**Technology Stack:** Fastify 5.6.0, Prisma 6.16.2, Zod 4.0.0 validation, Pino 9.10 logging, @fastify/env 5.0.2 for config.

### Sync Worker
**Responsibility:** Consume `sync_jobs`, orchestrate provider API calls, enforce privacy rules, update mappings, and record outcomes.

**Key Interfaces:**
- Direct access to PostgreSQL via Prisma and raw SQL for job claiming
- Provider SDKs within `packages/connectors`
- Publishes status to `sync_job_logs` and updates job records

**Dependencies:** PostgreSQL, `packages/connectors`, `packages/core`, prom-client for job metrics, pino logging.

**Technology Stack:** Node.js 22 worker process, Prisma client, concurrency guard utilities, prom-client instrumentation.

### Connectors Library
**Responsibility:** Encapsulate provider-specific logic (OAuth flows, ICS ingestion, IMAP parsing) behind a uniform adapter interface.

**Key Interfaces:**
- `ConnectorAdapter` contract (`validate`, `fetchWindow`, `createMirror`, `updateMirror`, `deleteMirror`)
- Shared utilities for rate limiting, schema validation, and token management

**Dependencies:** Provider SDKs (Google, Microsoft Graph), node-ical, IMAP client, libsodium for secret handling.

**Technology Stack:** TypeScript package published within monorepo (`packages/connectors`), leveraging functional adapters and dependency injection.

### Component Diagram
```mermaid
graph LR
  subgraph Client
    Portal[Portal (Next.js)]
  end

  subgraph Backend
    API[API Service (Fastify)]
    Worker[Sync Worker]
    Connectors[Connectors Library]
    Core[Shared Core Packages]
  end

  subgraph Data
    DB[(PostgreSQL 16.10)]
  end

  Portal -->|REST| API
  API -->|Prisma| DB
  Worker -->|Prisma + SQL| DB
  API -->|Domain Types| Core
  Worker -->|Domain Types| Core
  API -->|Adapter Contracts| Connectors
  Worker -->|Adapter Contracts| Connectors
```


## Extensibility (Phase 2)
- Webhooks-only extension point (recommended): emit selected events (e.g., alert created, job failed) to configured URLs
- Plugin system is out of scope for MVP; revisit after stabilization
