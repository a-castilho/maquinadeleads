-- Google Maps / Places lead enrichment fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_rating NUMERIC(3,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_reviews INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_category VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_leads_google_place_id
  ON leads (niche_id, google_place_id)
  WHERE google_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_source_category
  ON leads (niche_id, source_category, created_at DESC);
