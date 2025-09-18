# Tech Debt Ledger

Purpose: Track known tradeoffs and deferred work so we can pay them down deliberately after MVP.

## Status Keys
- Status: Open | Planned | Accepted | Resolved
- Severity: P1 (High) | P2 (Med) | P3 (Low)

## Entries

| ID | Title | Area | Type | Severity | Status | Owner | Opened | Notes / Fix Plan |
|----|-------|------|------|----------|--------|-------|--------|-------------------|
| TD-001 | Compose placeholders for app services | Infra | Ops/Docs | P2 | Open | Dev | 2025-09-18 | Replace placeholder images/commands with real Dockerfiles and `build` contexts once code scaffolds land (Epic 1). |
| TD-002 | No CDN for MVP | Frontend | Arch/Perf | P3 | Accepted | Architect | 2025-09-18 | Rely on Next.js static serving; revisit if LCP/asset size exceeds budgets (>500KB critical path). |
| TD-003 | Gmail SMTP quotas/throughput | Ops | Ops | P3 | Accepted | Ops | 2025-09-18 | Fine for low volume; consider Postmark/SES for higher volume post‑MVP. |
| TD-004 | Plugin system deferred | Backend | Arch | P3 | Accepted | Architect | 2025-09-18 | MVP uses webhooks only; evaluate plugin architecture after stabilization. |
| TD-005 | Provider quota doc links | Docs | Docs | P2 | Planned | PO/Dev | 2025-09-18 | Add links to Google/Microsoft quota docs and brief guidance in PRD/EH strategy during Epic 2/3. |
| TD-006 | Perf budget checks in CI | Frontend | Perf | P2 | Planned | Dev | 2025-09-18 | Add Lighthouse/Playwright trace budgets after scaffolds to enforce LCP/TTI/TBT/CLS. |

## Notes
- Keep entries lean; update status/owners as work progresses.
- Close items by linking the PR that resolves them.
