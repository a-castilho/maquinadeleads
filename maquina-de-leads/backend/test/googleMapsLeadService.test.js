const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FIELD_MASK,
  normalizeArea,
  buildTextQuery,
  buildLocationBias,
  normalizeBrazilPhone,
  normalizePlace,
  applyFilters,
} = require('../src/services/googleMapsLeadService');

test('Google Places field mask requests coordinates for visual map markers', () => {
  assert.match(FIELD_MASK, /places\.location/);
});

test('buildTextQuery combines sector, extra term and location in text mode', () => {
  assert.equal(
    buildTextQuery({ sector: 'clínica odontológica', extraTerm: 'implantes', location: 'Belo Horizonte MG', area: { mode: 'text' } }),
    'clínica odontológica implantes Belo Horizonte MG'
  );
});

test('radius mode keeps explicit city out of query so Places location bias is respected', () => {
  assert.equal(
    buildTextQuery({ sector: 'clínica odontológica', extraTerm: 'implantes', location: 'Belo Horizonte MG', area: { mode: 'radius', latitude: -19.92, longitude: -43.94, radiusKm: 10 } }),
    'clínica odontológica implantes'
  );
});

test('buildLocationBias creates an official Places circle in meters', () => {
  assert.deepEqual(
    buildLocationBias({ mode: 'radius', latitude: -19.92, longitude: -43.94, radiusKm: 12 }),
    { circle: { center: { latitude: -19.92, longitude: -43.94 }, radius: 12000 } }
  );
});

test('normalizeArea rejects radius above Google Places 50 km limit', () => {
  assert.throws(
    () => normalizeArea({ mode: 'radius', latitude: -19.92, longitude: -43.94, radiusKm: 51 }),
    /raio/i
  );
});

test('normalizeBrazilPhone preserves Brazilian landline and mobile digits', () => {
  assert.equal(normalizeBrazilPhone('(31) 3333-4444'), '553133334444');
  assert.equal(normalizeBrazilPhone('(31) 99999-4444'), '5531999994444');
});

test('normalizePlace maps official Places fields including coordinates', () => {
  const place = normalizePlace({
    id: 'place-1', displayName: { text: 'Clínica Sorriso' }, formattedAddress: 'Rua A, Belo Horizonte - MG',
    location: { latitude: -19.9245, longitude: -43.9352 },
    nationalPhoneNumber: '(31) 99999-4444', websiteUri: 'https://clinicasorriso.com.br', rating: 4.7,
    userRatingCount: 88, primaryTypeDisplayName: { text: 'Dentista' }, businessStatus: 'OPERATIONAL',
    googleMapsUri: 'https://maps.google.com/?cid=1',
  });
  assert.equal(place.placeId, 'place-1');
  assert.equal(place.whatsapp, '5531999994444');
  assert.equal(place.rating, 4.7);
  assert.equal(place.reviews, 88);
  assert.equal(place.latitude, -19.9245);
  assert.equal(place.longitude, -43.9352);
});

test('normalizePlace also accepts normalized frontend payload for import', () => {
  const place = normalizePlace({
    placeId: 'place-2', name: 'Empresa Teste', address: 'São Paulo',
    phone: '(11) 3333-2222', phoneDigits: '551133332222', website: 'https://example.com',
    rating: 4.4, reviews: 22, category: 'Empresa', mapsUrl: 'https://maps.google.com/test',
    latitude: -23.5505, longitude: -46.6333,
  });
  assert.equal(place.placeId, 'place-2');
  assert.equal(place.name, 'Empresa Teste');
  assert.equal(place.phoneDigits, '551133332222');
  assert.equal(place.latitude, -23.5505);
  assert.equal(place.longitude, -46.6333);
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
