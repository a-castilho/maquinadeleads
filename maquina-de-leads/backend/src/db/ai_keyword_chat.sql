CREATE TABLE IF NOT EXISTS ai_keyword_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  principal JSONB NOT NULL DEFAULT '[]'::jsonb,
  contexto JSONB NOT NULL DEFAULT '[]'::jsonb,
  negativas JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider VARCHAR(40) NOT NULL DEFAULT 'fallback',
  model VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_keyword_chat_role_check CHECK (role IN ('user','assistant'))
);

CREATE INDEX IF NOT EXISTS idx_ai_keyword_chat_niche_created
  ON ai_keyword_chat_messages(niche_id, created_at ASC);
