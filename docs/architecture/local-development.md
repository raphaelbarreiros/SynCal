# Local Development Guide

This guide explains how to run SynCal locally, configure environment variables, and verify basic service health. It assumes a Docker Compose workflow per the architecture docs.

## Prerequisites
- Docker Engine ≥ 26 and Docker Compose v2.39.3
- Node.js 22 LTS (only needed if building/running without Docker)
- Git

## 1) Environment Setup
1. Copy the example env file and fill in values:
   
   ```bash
   cp .env.example .env.local
   ```

2. Set critical secrets (generate strong values):
   
   ```bash
   # Examples (do not paste literally into Git)
   openssl rand -base64 32   # for SESSION_SECRET
   openssl rand -base64 32   # for ENCRYPTION_KEY (store as base64)
   ```

   Set `INITIAL_ADMIN_EMAIL` to the email address that should receive the first administrator account. Optionally set `INITIAL_ADMIN_PASSWORD` for non-interactive startup; omit it to be prompted securely on first boot.

3. Optional: Set up Google/Microsoft OAuth now or later. Follow:
   
   - `docs/prd/provider-credentials-setup.md`

Notes:
- Do not commit `.env.local`. The repo `.gitignore` already excludes env files.
- For first boot, `INITIAL_ADMIN_EMAIL` seeds the portal with the chosen administrator email (with an optional password if `INITIAL_ADMIN_PASSWORD` is provided).

## 2) Start the Stack (Docker Compose)
The Compose file lives at the repository root. Start services with:

```bash
docker compose up --build
```

Expected services:
- Web (Next.js portal) at `http://localhost:3000`
- API (Fastify) at `http://localhost:3001`
- Worker (Node process)
- PostgreSQL 16 (data volume persisted)

Ports are configurable in `.env.local` (e.g., `PORT_WEB`, `PORT_API`).

Run `npm run smoke` to execute the automated smoke test (`docker compose up -d` + `/healthz` poll) and confirm the stack is healthy within five seconds.

## 2a) Database Migrations
The API service applies database migrations at startup using Prisma:

```
prisma migrate deploy
```

Requirements:
- `DATABASE_URL` set and reachable
- Prisma schema/migrations present (generated from `docs/architecture/database-schema.md`)

## 3) First-Run Verification
- API health: `GET http://localhost:3001/healthz` → 200 OK
- Portal login: Visit `http://localhost:3000`, sign in with the admin address configured via `INITIAL_ADMIN_EMAIL`
- Worker: Check container logs for heartbeat and job polling messages

## 4) Troubleshooting
- Ports in use: Change `PORT_WEB` or `PORT_API` in `.env.local` and restart Compose
- Database connection errors: Verify `DATABASE_URL` and that Postgres container is healthy
- Encryption key errors: Ensure `ENCRYPTION_KEY` is set and base64-encoded
- OAuth callback mismatch: Double‑check redirect URIs match your `*_REDIRECT_URI` env values

## 5) Running Without Docker (optional; when monorepo scaffolds exist)
When app packages are added, you can run services locally:
- Install dependencies at the repo root with npm
- Start each app (e.g., web, api, worker) with their respective dev scripts

This path requires a locally running Postgres and correct `.env.local` per this guide.

## 6) Stopping & Cleanup
- Stop services: `Ctrl+C` in the Compose terminal
- Remove containers: `docker compose down`
- Remove containers and volumes (data reset):

```bash
docker compose down -v
  ```

## Next Steps
- Use npm as the package manager (package-lock.json committed)
- Add the Compose file and CI workflow scaffolds referenced in the architecture docs
- Begin implementing stories starting with Epic 1 (platform foundation)
