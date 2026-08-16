const axios = require('axios');
const db = require('../config/db');

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildTextQuery({ sector, location, extraTerm = '' }) {
  const parts = [clean(sector), clean(extraTerm), clean(location)].filter(Boolean);
  if (!parts[0]) throw new Error('Setor é obrigatório para buscar no Google Maps.');
  if (!clean(location)) throw new Error('Cidade ou região é obrigatória para buscar no Google Maps.');
  return parts.join(' ');
}

function normalizeBrazilPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  return `55${digits}`;
}

function isBrazilianMobile(value) {
  const digits = normalizeBrazilPhone(value);
  if (!digits) return false;
  return digits.slice(2).length === 11 && digits[4] === '9';
}

function normalizePlace(place = {}) {
  const phone = clean(place.phone || place.nationalPhoneNumber || place.internationalPhoneNumber) || null;
  const normalizedPhone = clean(place.phoneDigits) || normalizeBrazilPhone(phone);
  const name = clean(place.name || place.displayName?.text || place.displayName || '');
  const whatsapp = clean(place.whatsapp) || (isBrazilianMobile(phone) ? normalizedPhone : null);
  return {
    placeId: clean(place.placeId || place.id),
    name,
    address: clean(place.address || place.formattedAddress),
    phone,
    phoneDigits: normalizedPhone || null,
    whatsapp: whatsapp || null,
    website: clean(place.website || place.websiteUri) || null,
    rating: Number(place.rating || 0),
    reviews: Number(place.reviews ?? place.userRatingCount ?? 0),
    category: clean(place.category || place.primaryTypeDisplayName?.text || place.primaryTypeDisplayName || ''),
    businessStatus: clean(place.businessStatus),
    mapsUrl: clean(place.mapsUrl || place.googleMapsUri) || null,
  };
}

function applyFilters(places, filters = {}) {
  const minRating = Math.min(5, Math.max(0, Number(filters.minRating) || 0));
  const minReviews = Math.max(0, Number(filters.minReviews) || 0);
  const requirePhone = Boolean(filters.requirePhone);
  const requireWebsite = Boolean(filters.requireWebsite);
  const requireWhatsapp = Boolean(filters.requireWhatsapp);
  const operationalOnly = filters.operationalOnly !== false;

  return (places || []).filter((place) => {
    if (requirePhone && !place.phone) return false;
    if (requireWebsite && !place.website) return false;
    if (requireWhatsapp && !place.whatsapp) return false;
    if (place.rating < minRating) return false;
    if (place.reviews < minReviews) return false;
    if (operationalOnly && place.businessStatus && place.businessStatus !== 'OPERATIONAL') return false;
    return true;
  });
}

async function getApiKey(nicheId) {
  const result = await db.query(
    `SELECT api_key FROM credentials
      WHERE niche_id = $1 AND provider = 'google_places'
      LIMIT 1`,
    [nicheId]
  );
  const apiKey = result.rows[0]?.api_key;
  if (!apiKey) throw new Error('Configure a chave Google Places API para esta campanha.');
  return apiKey;
}

async function searchPlaces(nicheId, params = {}) {
  const startedAt = Date.now();
  const apiKey = await getApiKey(nicheId);
  const textQuery = buildTextQuery(params);
  const pageSize = Math.min(20, Math.max(1, Number(params.pageSize) || 20));
  const body = {
    textQuery,
    pageSize,
    languageCode: 'pt-BR',
    regionCode: 'BR',
  };
  if (params.pageToken) body.pageToken = String(params.pageToken);

  console.log(`[google-maps] search start niche=${nicheId} query=${JSON.stringify(textQuery)} pageSize=${pageSize}`);
  const response = await axios.post('https://places.googleapis.com/v1/places:searchText', body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    timeout: Math.min(20000, Math.max(5000, Number(process.env.GOOGLE_PLACES_TIMEOUT_MS) || 12000)),
  });

  const raw = Array.isArray(response.data?.places) ? response.data.places : [];
  const normalized = raw.map(normalizePlace).filter((item) => item.placeId && item.name);
  const filtered = applyFilters(normalized, params.filters || {});
  const result = {
    query: textQuery,
    totalRaw: normalized.length,
    totalFiltered: filtered.length,
    places: filtered,
    nextPageToken: response.data?.nextPageToken || null,
    durationMs: Date.now() - startedAt,
  };
  console.log(`[google-maps] search done niche=${nicheId} raw=${result.totalRaw} filtered=${result.totalFiltered} durationMs=${result.durationMs}`);
  return result;
}

async function importPlaces(nicheId, places = [], query = '') {
  const client = await db.pool.connect();
  let inserted = 0;
  let duplicates = 0;
  try {
    await client.query('BEGIN');
    for (const raw of places) {
      const place = normalizePlace(raw);
      if (!place.placeId || !place.name) continue;
      const sourceUrl = place.mapsUrl || place.website || `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.placeId)}`;
      const snippet = [place.category, place.address, place.phone ? `Tel: ${place.phone}` : null, place.rating ? `Nota: ${place.rating}` : null, place.reviews ? `${place.reviews} avaliações` : null].filter(Boolean).join(' · ');
      const result = await client.query(
        `INSERT INTO leads (
           niche_id, nome_perfil, phone, whatsapp, link_whatsapp, snippet, fonte_url, original_query,
           status, enrichment_status, google_place_id, google_rating, google_reviews, google_maps_url,
           website_url, source_category, observacao
         )
         SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,'enriquecido',$10,$11,$12,$13,$14,'google_maps',$15
         WHERE NOT EXISTS (
           SELECT 1 FROM leads
            WHERE niche_id = $1
              AND (google_place_id = $10 OR ($4::text IS NOT NULL AND whatsapp = $4))
         )
         RETURNING id`,
        [
          nicheId,
          place.name.slice(0, 250),
          place.phoneDigits,
          place.whatsapp,
          place.whatsapp ? `https://wa.me/${place.whatsapp}` : null,
          snippet.slice(0, 1000),
          sourceUrl,
          clean(query).slice(0, 500),
          place.whatsapp ? 'pendente' : 'sem_telefone',
          place.placeId,
          place.rating || null,
          place.reviews || null,
          place.mapsUrl,
          place.website,
          `Google Maps import · ${place.address}`.slice(0, 2000),
        ]
      );
      if (result.rowCount) inserted += 1;
      else duplicates += 1;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(`[google-maps] import niche=${nicheId} received=${places.length} inserted=${inserted} duplicates=${duplicates}`);
  return { received: places.length, inserted, duplicates };
}

module.exports = {
  FIELD_MASK,
  buildTextQuery,
  normalizeBrazilPhone,
  normalizePlace,
  applyFilters,
  searchPlaces,
  importPlaces,
};
