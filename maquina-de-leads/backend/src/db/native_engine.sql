-- =====================================================================
-- Máquina de Leads — Motor nativo de jobs
-- =====================================================================

-- Alinha o schema real com campos já usados pelos controllers/workflows legados.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS descricao_extra TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(20) DEFAULT 'pendente';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_enrichment
  ON leads (niche_id, enrichment_status, created_at);

CREATE TABLE IF NOT EXISTS native_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id        UUID REFERENCES niches(id) ON DELETE CASCADE,
  job_type        VARCHAR(80) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at       TIMESTAMPTZ,
  locked_by       VARCHAR(150),
  last_error      TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT native_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
  CONSTRAINT native_jobs_attempts_check
    CHECK (attempts >= 0 AND max_attempts > 0)
);

CREATE INDEX IF NOT EXISTS idx_native_jobs_queue
  ON native_jobs (status, run_at, created_at);

CREATE INDEX IF NOT EXISTS idx_native_jobs_niche
  ON native_jobs (niche_id, created_at DESC);

CREATE TABLE IF NOT EXISTS native_job_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES native_jobs(id) ON DELETE CASCADE,
  attempt         INTEGER NOT NULL,
  worker_id       VARCHAR(150),
  status          VARCHAR(20) NOT NULL DEFAULT 'processing',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  error_message   TEXT,
  result          JSONB,
  CONSTRAINT native_job_executions_status_check
    CHECK (status IN ('processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_native_job_executions_job
  ON native_job_executions (job_id, started_at DESC);

CREATE OR REPLACE FUNCTION set_native_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_native_jobs_updated_at ON native_jobs;
CREATE TRIGGER trg_native_jobs_updated_at
BEFORE UPDATE ON native_jobs
FOR EACH ROW EXECUTE FUNCTION set_native_job_updated_at();
