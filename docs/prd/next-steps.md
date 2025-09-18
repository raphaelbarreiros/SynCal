# Next Steps
## UX Expert Prompt
"Please review the SynCal PRD and draft UX flows/wireframes covering the dashboard, connector wizard, calendar detail view, and settings screen, with emphasis on validation states and unified calendar interactions."

## Architect Prompt
"Please review the SynCal PRD and propose a detailed architecture focusing on the Postgres-backed job queue, connector abstraction design, security hardening (auth, encryption), and deployment topology for the Docker Compose stack."

## Action Items (from PO Checklist)
- [x] Provider Credential Setup doc (Owner: PO + Dev)
  - Create `docs/prd/provider-credentials-setup.md` with Google/Microsoft app creation steps, scopes, redirect URIs, and required env var names.
  - Acceptance: Can provision creds end-to-end using only this guide; `.env.example` updated.
- [x] Package Manager Decision (Owner: PO + Dev)
  - Decision: npm
  - Acceptance: `package-lock.json` present; docs consistently reference npm.
- [ ] Local Development & First-Run Guide (Owner: Dev)
  - Add `docs/architecture/local-development.md` covering prereqs, `.env.example`, `docker compose up`, migrations/seed, URLs, first admin login.
  - Acceptance: New contributor can run stack in <10 minutes.
- [ ] Compose & CI Scaffolds (Owner: Dev)
  - Add `infra/docker-compose.yml` for web/api/worker/postgres and `.github/workflows/build-and-release.yml` skeleton.
  - Acceptance: `docker compose up` succeeds locally; CI runs lint/test jobs.
- [ ] UI Build/Performance Notes (Owner: UX + Dev)
  - Update `docs/architecture/front-end-spec.md` with asset optimization/code-splitting and performance budgets.
  - Acceptance: Clear guidance for images, caching, and budgets.
- [ ] Post-MVP Analytics & Feedback Plan (Owner: PO)
  - Add a section to PRD on post-MVP analytics/eventing and user feedback loop.
  - Acceptance: Explicitly listed, with scope marked as deferred.
