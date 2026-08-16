CREATE TABLE IF NOT EXISTS ai_keyword_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL DEFAULT 'fallback',
  model VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  profile_completeness INTEGER,
  principal_count INTEGER NOT NULL DEFAULT 0,
  context_count INTEGER NOT NULL DEFAULT 0,
  prompt_version VARCHAR(40) NOT NULL DEFAULT 'company-profile-v1',
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_keyword_runs_status_check CHECK (status IN ('completed','fallback','failed'))
);

CREATE INDEX IF NOT EXISTS idx_ai_keyword_runs_niche_created
  ON ai_keyword_runs(niche_id, created_at DESC);
