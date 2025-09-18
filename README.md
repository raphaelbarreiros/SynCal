# SynCal

SynCal is a self-hosted calendar synchronization platform tailored for professionals who juggle multiple Google Workspace and Microsoft 365 environments. It delivers dependable busy-sync while respecting privacy, giving operators a secure portal and observability tools without depending on third-party SaaS.

## Key Capabilities
- **Multi-connector flexibility:** OAuth integrations for Google and Microsoft alongside HTML/ICS feeds, IMAP inbox parsing, and self-managed credentials.
- **Privacy-first mirroring:** Busy-title masking with per-calendar controls, removal safeguards, and encrypted secret storage.
- **Operational clarity:** Next.js + shadcn portal surfaces connector health, sync timelines, alerts, and configuration flows.
- **Durable sync engine:** Fastify API, Prisma-backed Postgres job queue, and dedicated worker delivering idempotent event lifecycle handling.
- **Docker-first delivery:** Designed to run via a single `docker compose up`, adapting easily to self-hosted environments.

## Architecture Snapshot
- **Frontend:** Next.js 15 portal with shadcn UI components and Tailwind styling.
- **Backend API:** Fastify service exposing REST endpoints for auth, connectors, calendars, and observability.
- **Worker:** Node.js process polling the Postgres-backed `sync_jobs` queue with exponential backoff handling.
- **Data Store:** PostgreSQL 16.10 for connectors, calendars, mappings, jobs, audit logs, and alerts.
- **Observability:** Structured logging (pino) and Prometheus-compatible metrics planned for API and worker.

Detailed architecture, schema, and workflow references live in `docs/architecture/`.

## Repository Layout
```
.
├── docs/
│   ├── prd/                 # Product requirements, epics, and UX goals
│   └── architecture/        # System design, tech stack, local dev guide
└── AGENTS.md                # BMAD agent directory for Codex CLI
```
Code packages (`apps/web`, `apps/api`, `apps/worker`, `packages/*`) are defined in the architecture docs and will be introduced as implementation begins.

## Getting Started (Coming Online)
1. **Review the docs:**
   - Product overview and epics: `docs/prd/index.md`
   - Technical architecture: `docs/architecture/high-level-architecture.md`
   - UI specification: `docs/architecture/front-end-spec.md`
2. **Prepare local prerequisites:** Install Docker Engine ≥ 26, Docker Compose v2.39.3, and Node.js 22 LTS (only required for non-Docker workflows). See `docs/architecture/local-development.md`.
3. **Configure environment secrets:** Copy `.env.example` to `.env.local` and populate secrets following `docs/prd/provider-credentials-setup.md`.
4. **Compose stack:** Infrastructure scaffolding is planned at `infra/docker-compose.yml`. Until committed, track progress via `docs/prd/next-steps.md`.
5. **CI pipeline:** A GitHub Actions workflow (`.github/workflows/build-and-release.yml`) will enforce lint/test/build once scaffolded.

## Repository Initialization & First Commit
Use this sequence when bringing the repository online or for fresh clones:

1. Initialize Git and set the remote:
   ```bash
   git init
   git remote add origin <your-remote>
   ```
2. Create base folders for upcoming scaffolds (keeps paths referenced in docs visible):
   ```bash
   mkdir -p infra .github/workflows
   touch infra/.gitkeep .github/workflows/.gitkeep
   ```
3. Commit the documentation baseline:
   ```bash
   git add .
   git commit -m "chore: add SynCal documentation baseline"
   ```
4. Push the initial commit and protect `main` in your VCS provider.
5. When ready, add Docker Compose and CI workflow files at the documented paths and follow `docs/architecture/local-development.md`.

## Roadmap Highlights
Refer to `docs/prd/next-steps.md` for the full checklist. Current priorities include:
- Package manager: npm (package-lock.json committed).
- Add Docker Compose stack and GitHub Actions CI skeleton.
- Expand UI performance guidance within the front-end spec (budgets, code-splitting, caching, image strategy).
- Document post-MVP analytics and feedback plan.
- CDN stance: No CDN for MVP; use Next.js static serving. Revisit if portal asset size grows.

## Contributing
1. Read the PRD and architecture documents to align on scope and standards.
2. Coordinate work through the `docs/stories` backlog once stories are promoted from draft.
3. Follow coding standards in `docs/architecture/coding-standards.md` (to be referenced once implementation begins).

Feedback and improvements to the documentation are welcome—open an issue or PR with context referencing the relevant section.
