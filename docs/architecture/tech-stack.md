## Tech Stack

| Category | Technology | Version | Purpose | Rationale |
| --- | --- | --- | --- | --- |
| Language | TypeScript | 5.9.2 | Shared language across portal, API, worker | Aligns with Next.js 15 toolchain and Prisma typings; keeps monorepo DX consistent |
| Runtime | Node.js | 22.17.0 | Runtime for API, worker, scripts | Latest active LTS with long support window and modern language features |
| Frontend Framework | Next.js | 15.1.8 | Portal SSR/ISR and routing | Current stable release; App Router matches PRD expectations |
| UI Library | shadcn | 3.3.1 | Component primitives and design system | Already in repo; complements Tailwind and Next.js conventions |
| Styling | Tailwind CSS | 4.1.13 | Utility-first styling | Latest Tailwind release with updated utility set; integrates tightly with shadcn templates |
| API Framework | Fastify | 5.6.0 | HTTP server for REST endpoints | Fast, TypeScript-friendly; v5.6 includes LTS listener semantics and security fixes |
| Validation | Zod | 4.0.0 | Runtime schema validation & typing | Shared request/response contracts across API and worker using the latest major release |
| ORM & Client | Prisma ORM / @prisma/client | 6.16.2 | Data modeling, migrations, typed DB access | Current Prisma release with expanded Postgres features and type-safe client reuse |
| Database | PostgreSQL | 16.10 | Primary data store & job queue | Supported maintenance release that fits Compose delivery |
| Queueing | Postgres `sync_jobs` table + worker loop | N/A | Durable job dispatch with retry/backoff | Eliminates external queue dependencies while keeping concurrency safe |
| Logging | pino | 9.10.0 | Structured logging for API & worker | Low overhead JSON output, integrates with transports; latest 9.10 fixes stream handling |
| Metrics | prom-client | 15.1.3 | Prometheus metrics exporter | Latest prom-client with native histogram support; satisfies observability KPIs |
| Testing (unit/integration) | Vitest | 3.2.4 | Unit & integration runner | Vite-powered speed; great watch ergonomics in monorepo |
| Testing (E2E) | Playwright | 1.55.0 | Portal + API end-to-end coverage | Cross-browser automation, integrates with CI; includes new Trace Viewer features |
| Linting | ESLint 9.35.0 + @typescript-eslint 8.44.0 | Static analysis | Latest ESLint paired with @typescript-eslint 8.44 ensures TypeScript-aware linting |
| Formatting | Prettier | 3.6.2 | Consistent formatting | Keeps formatting uniform across packages with latest fixes |
| Config & Secrets | @fastify/env 5.0.2 + dotenv-flow 4.0.3 | Schema-based env loading | Validates configuration at startup while remaining local-first |
| Containerization | Docker Engine ≥26 & Compose v2.39.3 | N/A | Local & production orchestration | Powers single `docker compose up` flow |
| CI/CD | GitHub Actions | Hosted | Lint/test/build pipelines | Widely adopted; easy to mirror on self-hosted runners |
| Docs & Diagrams | Mermaid CLI | 11.10.1 | Architecture diagram generation | Keeps diagrams version-controlled alongside markdown; supports latest Mermaid syntax |

