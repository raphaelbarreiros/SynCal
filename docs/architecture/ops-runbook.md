# Operations Runbook

Operational procedures for deploying, monitoring, troubleshooting, backing up, and restoring SynCal in Compose-based environments.

## Environments
- Development: local Docker Compose
- Staging/Production: single-host Compose with reverse proxy (Caddy/Traefik)

## Health & Endpoints
- API health: `GET /healthz` → 200 when DB + encryption key ready
- Metrics: `GET /metrics` (Prometheus format)

## Deployments
### With GitHub Actions (planned)
- Pipeline stages: lint → unit → integration → (optional) e2e → build images → publish → remote deploy
- Approval gate before production rollout

### Manual Deploy (until CI lands)
```
# Build and start
docker compose -f infra/docker-compose.yml pull
docker compose -f infra/docker-compose.yml up -d --build

# Apply DB migrations (API container handles migrate deploy at startup)
# Verify health
curl -sf http://localhost:3001/healthz
```

## Rollback
- Strategy: re-deploy previous tagged images; DB rollback only if required
```
# Example: set image tags in compose overrides back to previous
# then
docker compose -f infra/docker-compose.yml up -d

# If needed, restore DB from the latest backup (see Restore)
```

## Backups
- Postgres logical backups via `pg_dump`; schedule via cron or external job runner
```
# Create backup (inside or outside container)
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h localhost -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -F c -f syncal_$(date +%Y%m%d_%H%M%S).dump
```

## Restore
```
# Stop write traffic, then restore
PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  -h localhost -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c syncal_YYYYMMDD_HHMMSS.dump

# Verify API health and run smoke checks
curl -sf http://localhost:3001/healthz
```
- For point-in-time recovery (PITR), configure WAL archiving and a backup tool; otherwise use logical dumps.

## Secrets Rotation
1. Generate new `SESSION_SECRET` and/or `ENCRYPTION_KEY` securely. Keep the key base64-encoded per the shared config helper (`packages/config/src/index.ts`) and the guidance in `.env.example` and `docs/architecture/local-development.md#1-environment-setup`.
2. Update environment for API/worker containers (Docker/OS secrets)
3. Restart services; verify health and auth flows
4. For master key rotation, plan re-encryption strategy if needed

## Troubleshooting
- `GET /healthz` returns 503
  - Check DB connectivity, `ENCRYPTION_KEY`, and env validation failures (API logs)
- OAuth callback errors
  - Verify redirect URIs and tenant configuration; check provider logs
- Worker not claiming jobs
  - Confirm DB healthy; review job table; check concurrency/settings
- Rate limiting/429
  - Backoff policy active; monitor metrics and adjust thresholds if needed

## Monitoring
- Prometheus scrape (example)
```yaml
- job_name: syncal-api
  static_configs:
    - targets: ['api:3001']
  metrics_path: /metrics
```
- Alerts: threshold-based (e.g., consecutive failures, expired tokens); emails via SMTP

## SMTP (Gmail) Configuration
- Use an account with 2FA enabled and create an App Password
- Set `SMTP_HOST=smtp.gmail.com` and `SMTP_PORT=465` (SSL) or `587` (STARTTLS)
- Provide `SMTP_USER` (email address) and `SMTP_PASS` (app password)
- Set `SMTP_FROM` to a permitted address; workspace policies may restrict sender domains
- Throughput/limits are subject to Gmail quotas; consider a dedicated provider for higher volume

## References
- Infra & deploy: `docs/architecture/infrastructure-and-deployment.md`
- Security: `docs/architecture/security.md`
- Local dev: `docs/architecture/local-development.md`
