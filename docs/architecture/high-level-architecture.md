## High Level Architecture

### Technical Summary
SynCal ships as a Docker-orchestrated monorepo comprising a Next.js 15 portal, a Fastify-based API service, and a dedicated Node worker that executes sync jobs. All runtime services share a PostgreSQL 16.10 instance that stores connector metadata, calendar relationships, job queue entries, event mappings, and audit logs. The portal communicates with the API through authenticated REST endpoints, while the worker polls the database-backed job queue (`FOR UPDATE SKIP LOCKED`) to process pending sync windows and updates job state accordingly. Docker Compose packages the entire stack—web, API, worker, Postgres, and optional monitoring sidecars—so operators can deploy SynCal with a single `docker compose up` command while retaining full data ownership.

### High Level Overview
1. **Architectural Style:** Modular monolith with a companion worker. The API and worker are distinct processes but share domain libraries inside the monorepo.
2. **Repository Structure:** Monorepo (`apps/web`, `apps/api`, `apps/worker`, shared `packages/*`) as mandated in PRD NFR8.
3. **Service Layout:** Three primary services (portal, API, worker) plus PostgreSQL and optional observability sidecars. The portal calls the API synchronously; the worker consumes jobs asynchronously via the database.
4. **Primary Flow:** Admin authenticates in the portal → configures connectors → API persists encrypted secrets and schedules sync jobs → worker claims jobs, talks to provider APIs (Google, Microsoft, HTML/ICS, IMAP), writes mappings/audit entries → portal reads health metrics and status via API.
5. **Key Decisions:** Prefer Docker Compose over managed/container orchestration to honor the self-host requirement; centralize durable state in Postgres to reuse schemas for connectors, jobs, audit logs; isolate long-running provider interactions inside the worker; expose Prometheus-compatible metrics to meet observability KPIs without overcomplicating the stack.

### High Level Project Diagram
```mermaid
graph TD
    subgraph Client
      Admin[Admin Browser]
    end

    subgraph Web
      Portal[Next.js Portal]
    end

    subgraph API
      Api[Fastify API]
    end

    subgraph Worker
      Worker[Sync Worker]
    end

    subgraph Data
      Postgres[(PostgreSQL 16.10\nConfig + Jobs + Mappings + Audit)]
    end

    subgraph Monitoring
      Prom[Prometheus/Grafana (optional)]
    end

    subgraph External Providers
      Google[Google Calendar API]
      Microsoft[Microsoft Graph API]
      ICS[HTML/ICS Feeds]
      IMAP[IMAP Mailboxes]
    end

    Admin -->|HTTPS + Auth| Portal
    Portal -->|REST| Api
    Api -->|Read/Write| Postgres
    Worker -->|Poll Jobs| Postgres
    Worker -->|Sync Events| Google
    Worker -->|Sync Events| Microsoft
    Worker -->|Fetch Feeds| ICS
    Worker -->|Fetch Invites| IMAP
    Prom -->|Scrape Metrics| Api
    Prom -->|Scrape Metrics| Worker
```

### Architectural and Design Patterns
- **Containerized Modular Monolith:** Single API runtime alongside a worker process leveraging shared domain packages. _Rationale:_ Simplifies deployment while maintaining separation of concerns between synchronous APIs and asynchronous job execution.
- **Hexagonal Ports and Adapters:** Provider connectors implement a common `ConnectorAdapter` interface, isolating domain logic from provider SDK details. _Rationale:_ Enables uniform validation, sync, and error handling across OAuth, HTML/ICS, and IMAP strategies.
- **Repository Pattern:** Prisma-backed repositories encapsulate database access for connectors, calendars, jobs, and mappings. _Rationale:_ Improves testability and future proofs for schema changes.
- **Database-backed Job Queue:** PostgreSQL table with `FOR UPDATE SKIP LOCKED` semantics handles scheduling, retry metadata, and backoff. _Rationale:_ Avoids extra infrastructure like Redis while meeting reliability and idempotency needs.
- **Session-based Authentication with CSRF Protection:** Portal authentication relies on cookie-based sessions, Argon2 hashing, and anti-CSRF tokens. _Rationale:_ Keeps secrets off the client, supports revocation, and aligns with self-hosted privacy goals.

