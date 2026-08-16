const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeProfile,
  normalizeSyntheticCnpj,
} = require('../src/services/companyProfileService');

test('normalizeSyntheticCnpj keeps test identifiers compatible with legacy VARCHAR(18)', () => {
  assert.equal(
    normalizeSyntheticCnpj('TESTE-01.000.000/0001-01'),
    '01.000.000/0001-01'
  );
  assert.equal(normalizeSyntheticCnpj('12.345.678/0001-90'), '12.345.678/0001-90');
});

test('normalizeProfile produces a persistence-safe synthetic profile', () => {
  const profile = normalizeProfile({
    trade_name: 'Empresa Teste',
    legal_name: 'Empresa Teste Ltda.',
    cnpj: 'TESTE-01.000.000/0001-01',
    market_segment: 'Tecnologia',
    products_services: ['CRM B2B'],
    service_regions: ['Minas Gerais'],
    ideal_customer_profile: { description: 'PMEs B2B' },
    target_industries: ['Serviços'],
    target_company_sizes: ['Pequena'],
    target_roles: ['Diretor Comercial'],
    customer_pains: ['Baixa previsibilidade de vendas'],
    purchase_triggers: ['Crescimento do time comercial'],
    keywords_seed: ['CRM PME'],
    negative_keywords: ['curso'],
  });

  assert.equal(profile.cnpj.length, 18);
  assert.ok(profile.profile_completeness > 0);
  assert.ok(profile.generated_keywords.length > 0);
});
