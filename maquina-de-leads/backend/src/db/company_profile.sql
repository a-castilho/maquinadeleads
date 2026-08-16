CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  legal_name TEXT,
  trade_name TEXT,
  cnpj TEXT,
  website TEXT,
  linkedin_url TEXT,
  instagram_url TEXT,
  phone TEXT,
  email TEXT,
  headquarters_city TEXT,
  headquarters_state VARCHAR(2),
  service_regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  company_size TEXT,
  employee_range TEXT,
  annual_revenue_range TEXT,
  founding_year INTEGER,
  business_model TEXT,
  market_segment TEXT,
  subsegments JSONB NOT NULL DEFAULT '[]'::jsonb,
  cnaes JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  products_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  value_proposition TEXT,
  differentiators JSONB NOT NULL DEFAULT '[]'::jsonb,
  main_competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
  ideal_customer_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_industries JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_company_sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  buyer_personas JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_pains JSONB NOT NULL DEFAULT '[]'::jsonb,
  purchase_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  objections JSONB NOT NULL DEFAULT '[]'::jsonb,
  disqualifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  average_ticket TEXT,
  sales_cycle TEXT,
  sales_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  keywords_seed JSONB NOT NULL DEFAULT '[]'::jsonb,
  negative_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_notes TEXT,
  profile_completeness INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_profiles_completeness_check CHECK (profile_completeness BETWEEN 0 AND 100)
);

-- Instalações anteriores criaram CNPJ como VARCHAR(18). Os perfis sintéticos
-- usam um identificador explicitamente marcado como TESTE, portanto precisam
-- de espaço adicional. Mantemos TEXT para não confundir o dado de teste com
-- um CNPJ real e para tornar a migration retrocompatível.
ALTER TABLE company_profiles ALTER COLUMN cnpj TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_company_profiles_user ON company_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_segment ON company_profiles(market_segment);

DROP TRIGGER IF EXISTS trg_company_profiles_updated_at ON company_profiles;
CREATE TRIGGER trg_company_profiles_updated_at
BEFORE UPDATE ON company_profiles
FOR EACH ROW EXECUTE FUNCTION set_native_job_updated_at();
