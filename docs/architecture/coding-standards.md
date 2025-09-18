## Coding Standards
- **Languages & Runtimes:** TypeScript 5.9.2 targeting Node.js 22.17.0 and Next.js 15.1.8.
- **Style & Linting:** ESLint 9.35.0 with `@typescript-eslint` 8.44.0 recommended rules + project overrides; Prettier for formatting.
- **Test Organization:** Unit tests colocated beside sources as `*.test.ts`; integration tests under `apps/api/tests` and `apps/worker/tests` with descriptive folder names.

### Critical Rules
- **Use Shared Types:** Always import DTOs and domain types from `packages/core`; no ad-hoc interface duplication.
- **Log via Pino:** Never use `console.log`; use the shared logger from `packages/config/src/logging` with correlation ids.
- **Repository Access:** All database mutations must go through Prisma repositories; no inline Prisma calls in route handlers or React components.
- **Secrets Handling:** Call `packages/config/env` helpers for all configuration reads; never access `process.env` directly in feature code.
- **Async Error Handling:** Wrap Fastify route handlers with provided `asyncRoute` helper to ensure rejected promises bubble to the central error handler.


