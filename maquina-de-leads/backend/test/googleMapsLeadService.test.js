const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTextQuery,
  normalizeBrazilPhone,
  normalizePlace,
  applyFilters,
} = require('../src/services/googleMapsLeadService');

test('buildTextQuery combines sector, extra term and location', () => {
  assert.equal(
    buildTextQuery({ sector: 'clínica odontológica', extraTerm: 'implantes', location: 'Belo Horizonte MG' }),
    'clínica odontológica implantes Belo Horizonte MG'
  );
});

test('normalizeBrazilPhone preserves Brazilian landline and mobile digits', () => {
  assert.equal(normalizeBrazilPhone('(31) 3333-4444'), '553133334444');
  assert.equal(normalizeBrazilPhone('(31) 99999-4444'), '5531999994444');
});

test('normalizePlace maps official Places fields', () => {
  const place = normalizePlace({
    id: 'place-1',
    displayName: { text: 'Clínica Sorriso' },
    formattedAddress: 'Rua A, Belo Horizonte - MG',
    nationalPhoneNumber: '(31) 99999-4444',
    websiteUri: 'https://clinicasorriso.com.br',
    rating: 4.7,
    userRatingCount: 88,
    primaryTypeDisplayName: { text: 'Dentista' },
    businessStatus: 'OPERATIONAL',
    googleMapsUri: 'https://maps.google.com/?cid=1',
  });
  assert.equal(place.placeId, 'place-1');
  assert.equal(place.whatsapp, '5531999994444');
  assert.equal(place.rating, 4.7);
  assert.equal(place.reviews, 88);
});

test('normalizePlace also accepts normalized frontend payload for import', () => {
  const place = normalizePlace({
    placeId: 'place-2', name: 'Empresa Teste', address: 'São Paulo',
    phone: '(11) 3333-2222', phoneDigits: '551133332222', website: 'https://example.com',
    rating: 4.4, reviews: 22, category: 'Empresa', mapsUrl: 'https://maps.google.com/test',
  });
  assert.equal(place.placeId, 'place-2');
  assert.equal(place.name, 'Empresa Teste');
  assert.equal(place.phoneDigits, '551133332222');
});

test('applyFilters prioritizes phone, website, rating and review count', () => {
  const places = [
    { name: 'A', phone: '(31) 99999-0000', whatsapp: '5531999990000', website: 'https://a.com', rating: 4.8, reviews: 100, businessStatus: 'OPERATIONAL' },
    { name: 'B', phone: null, whatsapp: null, website: 'https://b.com', rating: 4.9, reviews: 200, businessStatus: 'OPERATIONAL' },
    { name: 'C', phone: '(31) 98888-0000', whatsapp: '5531988880000', website: null, rating: 3.9, reviews: 5, businessStatus: 'OPERATIONAL' },
  ];
  const filtered = applyFilters(places, { requirePhone: true, requireWebsite: true, minRating: 4.5, minReviews: 20 });
  assert.deepEqual(filtered.map((item) => item.name), ['A']);
});
