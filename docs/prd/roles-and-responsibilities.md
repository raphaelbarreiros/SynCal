# Roles & Responsibilities

This document clarifies which tasks belong to humans (operators/owners) and which belong to developer agents for SynCal. It also records who owns each secret and the approval gates for risky operations.

## Overview
- Project Type: Greenfield with UI (portal + API + worker)
- Delivery Model: Docker Compose (single host), GitHub Actions CI

## Responsibility Matrix

### User / Operator (Human)
- Create and manage Google/Microsoft OAuth apps (consent screen, scopes, test users) and provide env values.
- Provision production infra: VPS/VM, reverse proxy (Caddy/Traefik), persistent volumes, backups.
- Configure DNS and TLS for the public domain(s).
- Provision SMTP or mail relay and provide `SMTP_*` env values.
- Maintain secrets outside Git (OS/Docker secrets/VAULT) and rotate regularly.
- Approve production deployments and schema migrations; own rollback decisions.
- Own data governance policies (backups/retention/privacy defaults, calendar removal policy).
- Purchasing/Payment: Acquire domains/DNS plans, email (SMTP) provider plans, VPS/VM resources, container registry subscriptions/quotas, and any provider API quotas as needed.

### Developer Agent(s)
- Implement portal, API, and worker per PRD/architecture.
- Define Prisma schema and migrations; enforce env schema validation at startup.
- Implement encryption using `ENCRYPTION_MASTER_KEY`; redact logs; audit secret access.
- Implement OAuth callbacks, token storage (encrypted), connector validation jobs, and fallback ordering.
- Compose stack configuration (`infra/docker-compose.yml`) and CI workflows (`.github/workflows/*`).
- Frontend UX: navigation, wizards, accessibility (WCAG AA), performance strategies.
- Testing: Vitest unit/integration; Playwright E2E; axe accessibility checks.
- Developer conveniences: local MailHog (or similar), provider mocks/stubs for tests.

## Secrets Ownership
- `SESSION_SECRET` — User/Operator
- `ENCRYPTION_MASTER_KEY` — User/Operator
- `DATABASE_URL` — User/Operator (Dev provides format requirements)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_OAUTH_SCOPES` — User/Operator
- `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT_ID`, `MS_REDIRECT_URI`, `MS_OAUTH_SCOPES` — User/Operator
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — User/Operator
- Container registry credentials, CI secrets — User/Operator (Dev supplies names/usage)

## Approval Gates
- Provider enablement in production — User approval
- Database schema migrations — User approval prior to deploy
- Production deployment & rollback — User approval
- Secret key rotation — User approval; Dev assists with rollout plan

## Notes
- Never commit real secrets. Use `.env.local` for development, Docker/OS secrets for production.
- For rollout safety, prefer feature flags and blue/green or canary strategies where feasible.
