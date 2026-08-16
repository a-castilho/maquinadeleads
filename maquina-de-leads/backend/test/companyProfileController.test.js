const test = require('node:test');
const assert = require('node:assert/strict');

const {
  serializeField,
  buildProfileValues,
  TEST_PROFILES,
} = require('../src/controllers/companyProfileController');

test('serializeField encodes JSONB arrays as valid JSON text', () => {
  const serialized = serializeField('service_regions', ['São Paulo', 'Minas Gerais']);
  assert.equal(serialized, '["São Paulo","Minas Gerais"]');
  assert.deepEqual(JSON.parse(serialized), ['São Paulo', 'Minas Gerais']);
});

test('serializeField encodes ICP object as JSON', () => {
  const serialized = serializeField('ideal_customer_profile', { description: 'PMEs B2B', min_employees: '10' });
  assert.deepEqual(JSON.parse(serialized), { description: 'PMEs B2B', min_employees: '10' });
});

test('serializeField keeps scalar database fields unchanged', () => {
  assert.equal(serializeField('trade_name', 'Nuvem Forte'), 'Nuvem Forte');
  assert.equal(serializeField('founding_year', '2019'), '2019');
});

test('all synthetic company profiles can be normalized and serialized for persistence', () => {
  assert.ok(TEST_PROFILES.length >= 4);

  for (const seed of TEST_PROFILES) {
    const { profile, values } = buildProfileValues(seed);
    assert.equal(values.length, 42);
    assert.ok(profile.trade_name);
    assert.ok(profile.profile_completeness > 0);
    assert.ok(profile.generated_keywords.length > 0);

    for (const field of [
      'service_regions', 'products_services', 'target_roles', 'customer_pains',
      'keywords_seed', 'negative_keywords', 'generated_keywords', 'ideal_customer_profile',
    ]) {
      const index = [
        'legal_name','trade_name','cnpj','website','linkedin_url','instagram_url','phone','email',
        'headquarters_city','headquarters_state','service_regions','company_size','employee_range',
        'annual_revenue_range','founding_year','business_model','market_segment','subsegments','cnaes',
        'description','products_services','value_proposition','differentiators','main_competitors',
        'ideal_customer_profile','target_industries','target_company_sizes','target_roles','buyer_personas',
        'customer_pains','purchase_triggers','objections','disqualifiers','average_ticket','sales_cycle',
        'sales_channels','keywords_seed','negative_keywords','generated_keywords','search_notes','profile_completeness'
      ].indexOf(field);
      assert.doesNotThrow(() => JSON.parse(values[index]), `${seed.trade_name}: ${field} precisa ser JSON válido`);
    }
  }
});
