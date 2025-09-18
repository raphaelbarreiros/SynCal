## Security

### Input Validation
- **Validation Library:** Zod 4.0.0
- **Validation Location:** Fastify route schema parsers (API) and worker job deserializers
- **Required Rules:**
  - All external inputs MUST be validated with Zod before business logic
  - Validation occurs at API boundary and worker job ingestion
  - Prefer whitelisting allowed fields; reject unknown keys by default

### Authentication & Authorization
- **Auth Method:** Cookie-based session auth with Argon2 password hashing
- **Session Management:** Signed, HTTP-only cookies via `@fastify/session`; refresh on activity and rotate session IDs after privilege changes
- **Required Patterns:**
  - Enforce CSRF protection via `@fastify/csrf-protection`
  - Wrap protected routes with `requireAdmin` guard that checks session + role

### Secrets Management
- **Development:** `.env.local` managed via `dotenv-flow`; secrets encrypted at rest using age or SOPS when committed
- **Production:** Docker secrets / OS-level secret store mounted into containers
- **Code Requirements:**
  - NEVER hardcode secrets or tokens
  - Access secrets through `packages/config/env`
  - Strip secrets from logs and error messages

### API Security
- **Rate Limiting:** `@fastify/rate-limit` enforcing per-IP login limits and per-connector validation throttles
- **CORS Policy:** Locked to configured portal origin; preflight responses cached with short TTL
- **Security Headers:** Apply via `@fastify/helmet` (HSTS, X-Frame-Options, CSP)
- **HTTPS Enforcement:** TLS termination handled by reverse proxy (Caddy/Traefik); redirect HTTP→HTTPS for portal/API

### Data Protection
- **Encryption at Rest:** PostgreSQL volume encrypted at filesystem level; connector secrets stored via libsodium sealed box
- **Encryption in Transit:** HTTPS for portal/API; worker-provider calls enforce TLS 1.2+
- **PII Handling:** Only store admin email; redact event metadata when privacy mode is `busy`
- **Logging Restrictions:** No credentials, tokens, or raw event descriptions in logs when privacy mode active

### Dependency Security
- **Scanning Tool:** Dependabot + `npm audit` in CI
- **Update Policy:** Weekly dependency review; patch security advisories within 48 hours
- **Approval Process:** New runtime dependency requires security review entry in PR template

### Security Testing
- **SAST Tool:** Semgrep ruleset run in CI
- **DAST Tool:** OWASP ZAP baseline scan against staging portal monthly
- **Penetration Testing:** Annual third-party assessment; scoped retest before major release
