# Code Review Guidelines

These guidelines define what reviewers and authors must check before merging changes. They align with the PRD, architecture, and security requirements of SynCal.

## Scope
- Services: `apps/api`, `apps/web`, `apps/worker`
- Shared packages: `packages/*`
- Infrastructure & scripts: `infra/*`, `scripts/*`, CI workflows

## Review Checklist

### Architecture & Structure
- Changes respect the documented source tree and layering (no cross-layer leaks).
- Reuse shared packages (`core`, `config`, `connectors`, `ui`) where applicable.

### Security
- Inputs validated (Zod) at API boundaries and worker ingestion.
- Sessions/auth guards applied to protected routes.
- Rate limiting and security headers configured where appropriate.
- No secrets or tokens logged; sensitive fields redacted.
- Crypto uses `ENCRYPTION_MASTER_KEY`; secrets only decrypted in-memory.

### Data & Migrations
- Prisma schema diffs reviewed; new fields, indexes, and enums documented.
- Backward compatibility considered; migrations are idempotent and safe on live data.
- Data migrations include rollback notes or compensating strategies.

### Configuration & Secrets
- Env schema validates required vars; safe defaults; startup fails fast when missing.
- New env keys documented in `.env.example` and relevant docs.

### Observability
- pino logging levels appropriate; no sensitive data.
- Metrics exposed via `prom-client` where meaningful; names consistent.
- Health endpoints reflect dependency readiness (DB, encryption key).

### Privacy
- Busy vs original title logic enforced where applicable.
- UI and logs respect privacy mode (no leaking event details in busy mode).

### Performance
- Avoid N+1 DB queries and excessive per-request work.
- Caching or memoization considered for hot paths.
- Frontend: code-splitting and lazy loading for heavy panels; image optimization strategy followed.

### Frontend UX
- Accessibility: WCAG 2.1 AA basics—contrast, keyboard nav, ARIA labels.
- Responsive behavior verified at documented breakpoints.
- Forms provide inline validation and actionable error messages.

### Testing
- Unit tests for new logic; integration tests for routes/services; Playwright for critical flows.
- Flaky patterns avoided; deterministic test data via factories/fixtures.

### Documentation
- Relevant docs updated (API spec, local dev, runbook, PRD stories).
- Migration and operational notes included when behavior changes.

## Reviewer/Author Checkboxes
- [ ] Validations and guards present; secrets redacted
- [ ] Prisma migration reviewed and safe
- [ ] Env keys validated and documented
- [ ] Logs/metrics/health updated appropriately
- [ ] Tests added/updated and passing locally
- [ ] Docs updated; links included in PR description

## References
- Security: `docs/architecture/security.md`
- Test strategy: `docs/architecture/test-strategy-and-standards.md`
- Infra & deploy: `docs/architecture/infrastructure-and-deployment.md`
- Ops: `docs/architecture/ops-runbook.md`
