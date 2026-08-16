-- =====================================================================
-- Máquina de Leads — Motor nativo de jobs
-- =====================================================================

-- Mantém `niches` como entidade interna para compatibilidade, mas adiciona
-- os campos necessários para tratar cada registro como uma campanha no produto.
ALTER TABLE niches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE niches ADD COLUMN IF NOT EXISTS offer TEXT;
ALTER TABLE niches ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE niches ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE niches ADD COLUMN IF NOT EXISTS campaign_status VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE niches ADD COLUMN IF NOT EXISTS min_lead_score INTEGER NOT NULL DEFAULT 55;

CREATE INDEX IF NOT EXISTS idx_niches_user_campaign_status
  ON niches (user_id, campaign_status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'niches_min_lead_score_check'
  ) THEN
    ALTER TABLE niches
      ADD CONSTRAINT niches_min_lead_score_check
      CHECK (min_lead_score BETWEEN 0 AND 100);
  END IF;
END $$;

-- Alinha o schema real com campos já usados pelos controllers/workflows legados.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS descricao_extra TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(20) DEFAULT 'pendente';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Qualificação e funil nativos.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS funnel_stage VARCHAR(30) NOT NULL DEFAULT 'discovered';

CREATE INDEX IF NOT EXISTS idx_leads_enrichment
  ON leads (niche_id, enrichment_status, created_at);

CREATE INDEX IF NOT EXISTS idx_leads_scoring
  ON leads (niche_id, lead_score DESC, scored_at);

CREATE INDEX IF NOT EXISTS idx_leads_funnel
  ON leads (niche_id, funnel_stage, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_score_check'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_score_check
      CHECK (lead_score IS NULL OR lead_score BETWEEN 0 AND 100);
  END IF;
END $$;

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
  CONSTRAINT native_jobs_attempts_check
    CHECK (attempts >= 0 AND max_attempts > 0)
);

-- A constraint é recriada para que instalações que já executaram versões
-- anteriores da migration também passem a aceitar o estado cancelled.
ALTER TABLE native_jobs DROP CONSTRAINT IF EXISTS native_jobs_status_check;
ALTER TABLE native_jobs
  ADD CONSTRAINT native_jobs_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry', 'cancelled'));

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

-- Outbox de primeiro contato. A chave é estável por campanha + lead + tipo,
-- evitando reenvio automático quando o resultado do provedor for ambíguo.
CREATE TABLE IF NOT EXISTS native_message_outbox (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id            UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  template_id         UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  message_kind        VARCHAR(30) NOT NULL DEFAULT 'initial',
  idempotency_key     VARCHAR(180) NOT NULL UNIQUE,
  status              VARCHAR(20) NOT NULL DEFAULT 'reserved',
  attempts            INTEGER NOT NULL DEFAULT 0,
  request_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload    JSONB,
  response_status     INTEGER,
  last_error          TEXT,
  reserved_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sending_at          TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT native_message_outbox_status_check
    CHECK (status IN ('reserved', 'sending', 'sent', 'failed', 'unknown')),
  CONSTRAINT native_message_outbox_attempts_check
    CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_native_message_outbox_niche
  ON native_message_outbox (niche_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_native_message_outbox_lead
  ON native_message_outbox (lead_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_native_message_initial_active
  ON native_message_outbox (niche_id, lead_id, message_kind)
  WHERE status IN ('reserved', 'sending', 'sent', 'unknown');

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

DROP TRIGGER IF EXISTS trg_native_message_outbox_updated_at ON native_message_outbox;
CREATE TRIGGER trg_native_message_outbox_updated_at
BEFORE UPDATE ON native_message_outbox
FOR EACH ROW EXECUTE FUNCTION set_native_job_updated_at();
