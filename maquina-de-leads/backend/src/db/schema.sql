-- =====================================================================
-- Máquina de Leads — Schema PostgreSQL
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- Usuários (login do dashboard)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'admin', -- admin | operator
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Nichos de mercado (cada nicho = um "produto" de leads: música, imóveis,
-- odontologia, etc.) Cada nicho pertence a um usuário/conta.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS niches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  slug        VARCHAR(160) UNIQUE NOT NULL,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Credenciais de integração por nicho (SerpAPI/Serper, Evolution API, etc)
-- Guardadas por nicho para permitir múltiplas instâncias/WhatsApp por conta.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credentials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id       UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  provider       VARCHAR(50) NOT NULL, -- 'serper' | 'evolution_api' | 'n8n'
  api_key        TEXT,
  base_url       TEXT,
  extra_config   JSONB DEFAULT '{}'::jsonb, -- ex: { "instanceName": "tocaai" }
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (niche_id, provider)
);

-- ---------------------------------------------------------------------
-- Palavras-chave de busca por nicho (substitui o array fixo "nichos" do
-- node "Gerador de Matriz"). O campo "kind" indica o papel da palavra
-- na composição das queries de busca (dork).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS keywords (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id   UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  term       VARCHAR(150) NOT NULL,
  kind       VARCHAR(20) NOT NULL DEFAULT 'nicho', -- 'nicho' | 'contexto' | 'termo_completo'
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Templates de mensagem de WhatsApp por nicho (substitui a string fixa
-- em "formataCel"). Suporta variáveis {{nome}}.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id   UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL DEFAULT 'Padrão',
  body       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Leads coletados — tabela única multi-nicho (substitui leads_prospeccao)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id               UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  nome_perfil            VARCHAR(250),
  whatsapp               VARCHAR(20),
  wa_username            VARCHAR(150),
  link_whatsapp          TEXT,
  link_instagram         TEXT,
  snippet                TEXT,
  fonte_url              TEXT,
  original_query         TEXT,
  status                 VARCHAR(20) NOT NULL DEFAULT 'pendente', -- pendente | enviado | erro
  ultima_mensagem_enviada TIMESTAMPTZ,
  extraido_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (niche_id, whatsapp)
);

CREATE INDEX IF NOT EXISTS idx_leads_niche_status ON leads (niche_id, status);

-- ---------------------------------------------------------------------
-- Agentes n8n gerados pelo dashboard (1 agente de raspagem + 1 de envio
-- por nicho, tipicamente)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS n8n_agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id       UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  agent_type     VARCHAR(20) NOT NULL, -- 'raspagem' | 'envio'
  n8n_workflow_id VARCHAR(100),
  webhook_url    TEXT,
  active         BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at   TIMESTAMPTZ,
  config_snapshot JSONB DEFAULT '{}'::jsonb, -- config usada para gerar o workflow
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (niche_id, agent_type)
);

-- ---------------------------------------------------------------------
-- Trigger genérico para updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','niches','leads','n8n_agents']
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
      CREATE TRIGGER trg_%1$s_updated_at
      BEFORE UPDATE ON %1$s
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t);
  END LOOP;
END $$;
