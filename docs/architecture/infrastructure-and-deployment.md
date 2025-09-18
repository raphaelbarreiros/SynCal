## Infrastructure and Deployment

### Infrastructure as Code
- **Tool:** Docker Compose v2.39.3
- **Location:** `infra/docker-compose.yml`
- **Approach:** Declarative Compose file defining web, api, worker, postgres, and optional observability services; environment-specific overrides via `docker-compose.override.yml`. No CDN in MVP; portal serves static assets directly.

### Deployment Strategy
- **Strategy:** Single-host Docker Compose deployment with environment-specific `.env` files and secrets injection.
- **CI/CD Platform:** GitHub Actions (self-hostable runner supported).
- **Pipeline Configuration:** ` .github/workflows/build-and-release.yml`
  - Pull Requests: `lint` + `unit` + `integration`
  - Main merges: `integration` + build/publish images
  - Nightly/Staging: `e2e` against staging stack; manual approval before prod deploy

### Environments
- **Development:** Local Docker Compose stack using hot reload volumes, seeded Postgres, and mocked provider credentials.
- **Staging:** Optional VPS Compose deployment mirroring production config; uses staging OAuth credentials and real provider sandboxes.
- **Production:** Hardened VPS/VM with Compose stack, TLS termination via Caddy/Traefik reverse proxy, persistent volumes and offsite Postgres backups.

### Environment Promotion Flow
```text
[main branch merge]
    ↓ (GitHub Actions)
Build → Test → Publish images (web/api/worker)
    ↓
Staging deploy (optional) → smoke tests
    ↓ Manual approval
Production deploy via remote docker compose pull & up
```

### Rollback Strategy
- **Primary Method:** `docker compose rollback` using tagged image history + Postgres point-in-time recovery snapshot.
- **Trigger Conditions:** Release smoke tests fail, elevated error rates, sync job failure spike, or security regression.
- **Recovery Time Objective:** < 30 minutes (compose redeploy + PITR restore script).

### DNS & TLS
- **Domains:** Point your public domain (e.g., `syn.example.com`) A/AAAA records to the host running the Compose stack.
- **Reverse Proxy (Recommended):** Single domain with API path prefix
  - Portal at `https://syn.example.com/`
  - API at `https://syn.example.com/api`
- **Alternative:** Separate subdomain (e.g., `https://api.syn.example.com`) if network/ops policies require it.
- **Certificates:** Enable automatic Let’s Encrypt (HTTP‑01) issuance on the proxy.
- **Environment:** Set `APP_BASE_URL` and `API_BASE_URL` accordingly; path-prefix setup simplifies cookies/CORS.
