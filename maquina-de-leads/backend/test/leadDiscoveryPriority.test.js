const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQueries } = require('../src/services/leadDiscoveryService');
const { computeScore } = require('../src/services/leadScoringService');

test('discovery prioritizes phone signals on Instagram, Facebook and Google Maps', () => {
  const queries = buildQueries(['odontologia'], ['contato'], 10, 'Belo Horizonte MG');
  assert.match(queries[0], /telefone whatsapp .*site:instagram\.com/);
  assert.match(queries[1], /telefone whatsapp .*site:facebook\.com/);
  assert.match(queries[2], /telefone .*site:google\.com\/maps/);
});

test('lead with phone but no WhatsApp still receives contact score', () => {
  const result = computeScore({
    campaign: { location: 'Belo Horizonte MG' },
    keywords: [{ kind: 'nicho', term: 'odontologia' }],
    lead: {
      nome_perfil: 'Clínica Exemplo',
      phone: '553133334444',
      whatsapp: null,
      email: null,
      enrichment_status: 'enriquecido',
      snippet: 'Odontologia em Belo Horizonte MG',
      original_query: 'odontologia Belo Horizonte MG',
      fonte_url: 'https://maps.google.com/example',
      source_category: 'google_maps',
      google_place_id: 'place-1',
      google_reviews: 15,
    },
  });
  assert.ok(result.score >= 55);
  assert.ok(result.breakdown.some((item) => item.reason === 'Telefone disponível'));
  assert.ok(result.breakdown.some((item) => item.reason === 'Empresa validada no Google Maps'));
});
