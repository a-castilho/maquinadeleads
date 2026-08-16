const test = require('node:test');
const assert = require('node:assert/strict');
const { after } = require('node:test');

const db = require('../src/config/db');
const {
  buildProfileValues,
  TEST_PROFILES,
} = require('../src/controllers/companyProfileController');

const FIELDS = [
  'legal_name','trade_name','cnpj','website','linkedin_url','instagram_url','phone','email',
  'headquarters_city','headquarters_state','service_regions','company_size','employee_range',
  'annual_revenue_range','founding_year','business_model','market_segment','subsegments','cnaes',
  'description','products_services','value_proposition','differentiators','main_competitors',
  'ideal_customer_profile','target_industries','target_company_sizes','target_roles','buyer_personas',
  'customer_pains','purchase_triggers','objections','disqualifiers','average_ticket','sales_cycle',
  'sales_channels','keywords_seed','negative_keywords','generated_keywords','search_notes','profile_completeness'
];

after(async () => {
  await db.pool.end();
});

function insertSql() {
  const columns = FIELDS.join(', ');
  const placeholders = FIELDS.map((_, index) => `$${index + 2}`).join(', ');
  const updates = FIELDS.map((field) => `${field} = EXCLUDED.${field}`).join(', ');
  return `INSERT INTO company_profiles (user_id, ${columns}) VALUES ($1, ${placeholders}) ON CONFLICT (user_id) DO UPDATE SET ${updates}, updated_at = NOW() RETURNING *`;
}

test('synthetic company profile survives real PostgreSQL persistence', async () => {
  const email = `profile-test-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  let userId;

  try {
    const user = await db.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ('Profile Test', $1, 'not-used-in-test')
       RETURNING id`,
      [email]
    );
    userId = user.rows[0].id;

    const { profile, values } = buildProfileValues(TEST_PROFILES[0]);
    const saved = await db.query(insertSql(), [userId, ...values]);

    assert.equal(saved.rows.length, 1);
    assert.equal(saved.rows[0].trade_name, profile.trade_name);
    assert.equal(saved.rows[0].cnpj.length, 18);
    assert.ok(Array.isArray(saved.rows[0].service_regions));
    assert.ok(Array.isArray(saved.rows[0].generated_keywords));
    assert.ok(saved.rows[0].generated_keywords.length > 0);
    assert.ok(saved.rows[0].profile_completeness > 0);
  } finally {
    if (userId) await db.query('DELETE FROM users WHERE id = $1', [userId]);
  }
});
