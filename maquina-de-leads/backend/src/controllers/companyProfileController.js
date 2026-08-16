const db = require('../config/db');
const { normalizeProfile } = require('../services/companyProfileService');

const FIELDS = [
  'legal_name','trade_name','cnpj','website','linkedin_url','instagram_url','phone','email',
  'headquarters_city','headquarters_state','service_regions','company_size','employee_range',
  'annual_revenue_range','founding_year','business_model','market_segment','subsegments','cnaes',
  'description','products_services','value_proposition','differentiators','main_competitors',
  'ideal_customer_profile','target_industries','target_company_sizes','target_roles','buyer_personas',
  'customer_pains','purchase_triggers','objections','disqualifiers','average_ticket','sales_cycle',
  'sales_channels','keywords_seed','negative_keywords','generated_keywords','search_notes','profile_completeness'
];

async function getProfile(req, res, next) {
  try {
    const { rows } = await db.query('SELECT * FROM company_profiles WHERE user_id = $1', [req.user.id]);
    return res.json(rows[0] || null);
  } catch (err) { return next(err); }
}

async function upsertProfile(req, res, next) {
  try {
    const profile = normalizeProfile(req.body || {});
    const values = FIELDS.map((field) => profile[field] ?? null);
    const columns = FIELDS.join(', ');
    const placeholders = FIELDS.map((_, i) => `$${i + 2}`).join(', ');
    const updates = FIELDS.map((field) => `${field} = EXCLUDED.${field}`).join(', ');

    const sql = `
      INSERT INTO company_profiles (user_id, ${columns})
      VALUES ($1, ${placeholders})
      ON CONFLICT (user_id) DO UPDATE SET ${updates}
      RETURNING *
    `;
    const { rows } = await db.query(sql, [req.user.id, ...values]);
    return res.json(rows[0]);
  } catch (err) { return next(err); }
}

async function regenerateKeywords(req, res, next) {
  try {
    const current = await db.query('SELECT * FROM company_profiles WHERE user_id = $1', [req.user.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Perfil empresarial ainda não criado.' });
    const profile = normalizeProfile(current.rows[0]);
    const { rows } = await db.query(
      'UPDATE company_profiles SET generated_keywords = $2, profile_completeness = $3 WHERE user_id = $1 RETURNING *',
      [req.user.id, JSON.stringify(profile.generated_keywords), profile.profile_completeness]
    );
    return res.json(rows[0]);
  } catch (err) { return next(err); }
}

module.exports = { getProfile, upsertProfile, regenerateKeywords };
