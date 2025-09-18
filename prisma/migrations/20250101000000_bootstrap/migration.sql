CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TYPE "ConnectorType" AS ENUM ('google', 'microsoft', 'html_ics', 'imap', 'self_managed');
CREATE TYPE "ConnectorStatus" AS ENUM ('pending_validation', 'validated', 'disabled');
CREATE TYPE "PrivacyMode" AS ENUM ('original_title', 'busy_placeholder');
CREATE TYPE "SyncJobStatus" AS ENUM ('pending', 'in_progress', 'retrying', 'failed', 'completed');
CREATE TYPE "SyncJobOutcome" AS ENUM ('success', 'partial', 'failure');
CREATE TYPE "AlertSeverity" AS ENUM ('info', 'warning', 'critical');

CREATE TABLE "admin_users" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "email" CITEXT UNIQUE NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "connectors" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "owner_id" UUID NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
  "type" "ConnectorType" NOT NULL,
  "display_name" TEXT,
  "status" "ConnectorStatus" NOT NULL DEFAULT 'pending_validation',
  "credentials_encrypted" BYTEA NOT NULL,
  "config_json" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "last_validated_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "connectors_owner_idx" ON "connectors"("owner_id");

CREATE TABLE "calendars" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "connector_id" UUID NOT NULL REFERENCES "connectors"("id") ON DELETE CASCADE,
  "provider_calendar_id" TEXT NOT NULL,
  "display_name" TEXT,
  "privacy_mode" "PrivacyMode" NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("connector_id", "provider_calendar_id")
);
CREATE INDEX "calendars_connector_idx" ON "calendars"("connector_id");

CREATE TABLE "sync_pairs" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "primary_calendar_id" UUID NOT NULL REFERENCES "calendars"("id") ON DELETE CASCADE,
  "secondary_calendar_id" UUID NOT NULL REFERENCES "calendars"("id") ON DELETE CASCADE,
  "fallback_order" UUID[] NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "sync_pairs_unique_pair" UNIQUE ("primary_calendar_id", "secondary_calendar_id")
);
CREATE INDEX "sync_pairs_active_idx" ON "sync_pairs"("active");

CREATE TABLE "sync_jobs" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "pair_id" UUID NOT NULL REFERENCES "sync_pairs"("id") ON DELETE CASCADE,
  "connector_id" UUID NOT NULL REFERENCES "connectors"("id") ON DELETE CASCADE,
  "window_start" TIMESTAMPTZ NOT NULL,
  "window_end" TIMESTAMPTZ NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "SyncJobStatus" NOT NULL DEFAULT 'pending',
  "priority" SMALLINT NOT NULL DEFAULT 0,
  "retry_count" SMALLINT NOT NULL DEFAULT 0,
  "max_retries" SMALLINT NOT NULL DEFAULT 5,
  "next_run_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "sync_jobs_lookup_idx" ON "sync_jobs"("status", "next_run_at");
CREATE INDEX "sync_jobs_pair_idx" ON "sync_jobs"("pair_id");

CREATE TABLE "sync_job_logs" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "job_id" UUID NOT NULL REFERENCES "sync_jobs"("id") ON DELETE CASCADE,
  "pair_id" UUID NOT NULL REFERENCES "sync_pairs"("id") ON DELETE CASCADE,
  "connector_id" UUID NOT NULL REFERENCES "connectors"("id") ON DELETE CASCADE,
  "started_at" TIMESTAMPTZ NOT NULL,
  "finished_at" TIMESTAMPTZ NOT NULL,
  "processed_events" INTEGER NOT NULL DEFAULT 0,
  "failed_events" INTEGER NOT NULL DEFAULT 0,
  "outcome" "SyncJobOutcome" NOT NULL,
  "error_summary" TEXT
);
CREATE INDEX "sync_job_logs_job_idx" ON "sync_job_logs"("job_id");

CREATE TABLE "event_mappings" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "pair_id" UUID NOT NULL REFERENCES "sync_pairs"("id") ON DELETE CASCADE,
  "source_calendar_id" UUID NOT NULL REFERENCES "calendars"("id") ON DELETE CASCADE,
  "mirror_calendar_id" UUID NOT NULL REFERENCES "calendars"("id") ON DELETE CASCADE,
  "source_event_id" TEXT NOT NULL,
  "mirror_event_id" TEXT NOT NULL,
  "connector_id" UUID NOT NULL REFERENCES "connectors"("id") ON DELETE CASCADE,
  "last_synced_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("source_calendar_id", "source_event_id")
);
CREATE INDEX "event_mappings_pair_idx" ON "event_mappings"("pair_id");

CREATE TABLE "audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "actor_id" UUID REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor_id");
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity_type", "entity_id");

CREATE TABLE "alerts" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "pair_id" UUID REFERENCES "sync_pairs"("id") ON DELETE CASCADE,
  "connector_id" UUID REFERENCES "connectors"("id") ON DELETE CASCADE,
  "category" TEXT NOT NULL,
  "severity" "AlertSeverity" NOT NULL,
  "message" TEXT NOT NULL,
  "acknowledged" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "alerts_active_idx" ON "alerts"("acknowledged", "severity");

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_admin_users
BEFORE UPDATE ON "admin_users"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_timestamp_connectors
BEFORE UPDATE ON "connectors"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_timestamp_calendars
BEFORE UPDATE ON "calendars"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_timestamp_sync_pairs
BEFORE UPDATE ON "sync_pairs"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_timestamp_sync_jobs
BEFORE UPDATE ON "sync_jobs"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
