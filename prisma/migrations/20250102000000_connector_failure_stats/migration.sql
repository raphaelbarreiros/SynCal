CREATE TABLE "connector_failure_stats" (
  "connector_id" UUID NOT NULL REFERENCES "connectors"("id") ON DELETE CASCADE,
  "pair_id" UUID NOT NULL REFERENCES "sync_pairs"("id") ON DELETE CASCADE,
  "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
  "last_failure_at" TIMESTAMPTZ,
  "paused_until" TIMESTAMPTZ,
  PRIMARY KEY ("connector_id", "pair_id")
);

ALTER TABLE "sync_jobs"
  ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "sync_jobs_idempotency_key_key" ON "sync_jobs"("idempotency_key");
