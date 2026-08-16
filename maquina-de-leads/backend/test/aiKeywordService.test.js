const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildProfileContext,
  buildPrompt,
  fallbackKeywords,
  parseKeywordPayload,
} = require('../src/services/aiKeywordService');

test('buildProfileContext carries ICP and campaign signals into the AI prompt', () => {
  const profile = {
    trade_name: 'Empresa Teste',
    market_segment: 'Saúde',
    target_industries: ['Indústria'],
    target_roles: ['Gerente de RH'],
    customer_pains: ['Absenteísmo'],
    service_regions: ['Minas Gerais'],
  };
  const campaign = { name: 'RH MG', location: 'Belo Horizonte', offer: 'Saúde ocupacional' };
  const context = buildProfileContext(profile, campaign);
  assert.equal(context.segmento, 'Saúde');
  assert.deepEqual(context.decisores, ['Gerente de RH']);
  assert.equal(context.campanha.localizacao, 'Belo Horizonte');
  assert.match(buildPrompt(profile, campaign), /Absenteísmo/);
});

test('fallbackKeywords creates principal and context terms without an API key', () => {
  const plan = fallbackKeywords({
    market_segment: 'Logística',
    subsegments: ['Transporte rodoviário'],
    products_services: ['Armazenagem'],
    target_roles: ['Gerente de Logística'],
    service_regions: ['Paraná'],
    customer_pains: ['Atrasos de entrega'],
  }, { location: 'Curitiba' });
  assert.ok(plan.principal.includes('Logística'));
  assert.ok(plan.principal.includes('Armazenagem'));
  assert.ok(plan.contexto.includes('Curitiba'));
  assert.ok(plan.contexto.includes('whatsapp'));
});

test('parseKeywordPayload deduplicates and sanitizes model JSON', () => {
  const result = parseKeywordPayload(JSON.stringify({
    principal: [' clínica médica ', 'clínica médica', 'hospital'],
    contexto: [' whatsapp ', 'cnpj', 'cnpj'],
  }));
  assert.deepEqual(result.principal, ['clínica médica', 'hospital']);
  assert.deepEqual(result.contexto, ['whatsapp', 'cnpj']);
});
