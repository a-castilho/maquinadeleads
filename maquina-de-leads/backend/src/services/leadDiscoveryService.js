const axios = require('axios');
const db = require('../config/db');

const VALID_DDDS = new Set([
  11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,
  41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,
  71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99,
]);

const BLACKLIST_DOMAINS = ['amazon.', 'microsoft.', 'youtube.com', 'cinemark.', 'thehill.com'];
const BLACKLIST_TITLES = ['olx', 'playlist', 'como ativar whatsapp', 'vaga de emprego'];
const DEFAULT_CONTEXT = ['contato', 'telefone', 'whatsapp', 'cnpj'];
const SOCIAL_SITES = ['site:instagram.com', 'site:facebook.com', 'site:linktr.ee'];

function unique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function extractWhatsapp(text) {
  if (!text) return null;
  const value = String(text);
  const waMatch = value.match(/(?:wa\.me\/|phone=|whatsapp\.com\/send\?phone=|api\.whatsapp\.com\/send\?phone=)(\d{10,13})/i);
  if (waMatch) {
    let number = waMatch[1].replace(/\D/g, '');
    if (number.length === 11) number = `55${number}`;
    if (number.length === 13 && number.startsWith('55')) return number;
  }

  const phoneRegex = /(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*)(?:9\s*\d{4}|\d{4})[\s.-]?\d{4}/g;
  const matches = value.match(phoneRegex) || [];
  for (const match of matches) {
    const digits = match.replace(/\D/g, '');
    const complete = digits.length === 11 ? `55${digits}` : digits;
    if (complete.length !== 13 || !complete.startsWith('55')) continue;
    const ddd = Number(complete.substring(2, 4));
    if (VALID_DDDS.has(ddd) && complete[4] === '9') return complete;
  }
  return null;
}

function cleanProfileName(title) {
  if (!title) return 'Desconhecido';
  const raw = String(title).replace(/\s+/g, ' ').trim();
  const cleaned = raw
    .replace(/• Instagram photos and videos/gi, '')
    .replace(/Instagram/gi, '')
    .replace(/Facebook/gi, '')
    .replace(/LinkedIn/gi, '')
    .replace(/Link to (instagram|facebook)\.com/gi, '')
    .split('|')[0]
    .split(' - ')[0]
    .split(' — ')[0]
    .trim()
    .slice(0, 120);

  if (cleaned.length < 3) return 'Desconhecido';
  return cleaned;
}

function sourceCategory(url) {
  const value = String(url || '').toLowerCase();
  if (value.includes('instagram.com')) return 'instagram';
  if (value.includes('facebook.com')) return 'facebook';
  if (value.includes('tiktok.com')) return 'tiktok';
  if (value.includes('linkedin.com')) return 'linkedin';
  if (value.includes('google.com/maps') || value.includes('maps.google')) return 'google_maps';
  return 'web';
}

function buildQueries(keywords, contextTerms, maxQueries = 24, location = '') {
  const contexts = unique(contextTerms.length ? contextTerms : DEFAULT_CONTEXT).slice(0, 4);
  const queries = [];
  const add = (value) => {
    const query = String(value || '').replace(/\s+/g, ' ').trim();
    if (query && !queries.includes(query) && queries.length < maxQueries) queries.push(query);
  };

  for (const keywordRaw of unique(keywords)) {
    const keyword = keywordRaw.replace(/^["']+|["']+$/g, '').trim();
    if (!keyword) continue;

    add(`"${keyword}" ${location}`);
    add(`"${keyword}" empresa ${location}`);
    add(`"${keyword}" contato ${location}`);
    add(`"${keyword}" telefone ${location}`);
    add(`"${keyword}" whatsapp ${location}`);
    add(`"${keyword}" cnpj ${location}`);

    for (const context of contexts) add(`"${keyword}" ${context} ${location}`);
    for (const site of SOCIAL_SITES) add(`"${keyword}" ${location} ${site}`);

    if (queries.length >= maxQueries) break;
  }
  return queries;
}

function normalizeResults(response, query) {
  const data = response?.data || response || {};
  const results = [];
  const rawResults = Array.isArray(data.results) ? data.results : (Array.isArray(data.organic) ? data.organic : []);

  for (const item of rawResults) {
    results.push({
      title: item.title || '',
      link: item.url || item.link || item.href || '',
      snippet: item.content || item.snippet || item.body || '',
      query,
    });
  }

  if (Array.isArray(data.places)) {
    for (const place of data.places) {
      results.push({
        title: place.title || place.name || '',
        link: place.website || place.link || place.url || '',
        snippet: [place.address, place.category, place.phone].filter(Boolean).join(' · '),
        query,
      });
    }
  }
  return results;
}

function toLead(raw, nicheId) {
  const link = String(raw.link || '').trim();
  const title = String(raw.title || '').trim();
  const snippet = String(raw.snippet || '').trim();
  if (!link) return { lead: null, reason: 'sem_link' };
  if (BLACKLIST_DOMAINS.some((domain) => link.toLowerCase().includes(domain))) return { lead: null, reason: 'dominio_bloqueado' };
  if (BLACKLIST_TITLES.some((term) => title.toLowerCase().includes(term))) return { lead: null, reason: 'titulo_bloqueado' };

  const whatsapp = extractWhatsapp(`${title} ${snippet} ${link}`);
  const name = cleanProfileName(title);
  if (name === 'Desconhecido' && !whatsapp) return { lead: null, reason: 'sem_identificacao' };

  const waUsernameMatch = link.match(/(?:wa\.me\/|phone=)(\d{10,15})/i);
  return {
    reason: null,
    lead: {
      nicheId,
      nomePerfil: name,
      waUsername: waUsernameMatch ? waUsernameMatch[1] : null,
      whatsapp,
      linkWhatsapp: whatsapp ? `https://wa.me/${whatsapp}` : null,
      snippet: snippet.slice(0, 500),
      fonteUrl: link,
      fonteCategoria: sourceCategory(link),
      originalQuery: raw.query || '',
      status: whatsapp ? 'pendente' : 'sem_telefone',
    },
  };
}

async function loadConfig(nicheId) {
  const [nicheResult, keywordResult, credentialResult] = await Promise.all([
    db.query('SELECT * FROM niches WHERE id = $1', [nicheId]),
    db.query('SELECT term, kind FROM keywords WHERE niche_id = $1 AND active = true', [nicheId]),
    db.query('SELECT * FROM credentials WHERE niche_id = $1', [nicheId]),
  ]);

  const niche = nicheResult.rows[0];
  if (!niche) throw new Error('Campanha não encontrada.');
  const credentials = Object.fromEntries(credentialResult.rows.map((item) => [item.provider, item]));
  return {
    niche,
    keywords: keywordResult.rows.filter((item) => item.kind === 'nicho').map((item) => item.term),
    contextTerms: keywordResult.rows.filter((item) => item.kind === 'contexto').map((item) => item.term),
    credentials,
  };
}

async function executeProviders(query, config) {
  const requests = [];
  const names = [];
  const serper = config.credentials.serper;
  const timeout = Math.min(8000, Math.max(2500, Number(process.env.DISCOVERY_HTTP_TIMEOUT_MS) || 6000));

  if (serper?.api_key) {
    const headers = { 'X-API-KEY': serper.api_key, 'Content-Type': 'application/json' };
    requests.push(axios.post('https://google.serper.dev/search', { q: query, gl: 'br', hl: 'pt-br' }, { headers, timeout }));
    names.push('serper-search');
    requests.push(axios.post('https://google.serper.dev/maps', { q: query, gl: 'br', hl: 'pt-br' }, { headers, timeout }));
    names.push('serper-maps');
  }

  const searxngUrl = process.env.SEARXNG_URL || 'http://searxng:8080/search';
  if (searxngUrl) {
    requests.push(axios.get(searxngUrl, {
      params: { q: query, format: 'json', language: 'pt-BR', categories: 'general' },
      timeout,
    }));
    names.push('searxng');
  }

  const robotUrl = process.env.ROBO_PYTHON_URL;
  if (robotUrl) {
    const base = robotUrl.replace(/\/$/, '');
    requests.push(axios.post(`${base}/search`, { q: query }, { timeout }));
    names.push('robot-search');
    requests.push(axios.post(`${base}/maps`, { q: query }, { timeout }));
    names.push('robot-maps');
  }

  if (!requests.length) throw new Error('Nenhum provedor de descoberta configurado.');

  const settled = await Promise.allSettled(requests);
  const responses = [];
  const errors = [];
  settled.forEach((item, index) => {
    if (item.status === 'fulfilled') responses.push({ provider: names[index], response: item.value });
    else errors.push({ provider: names[index], error: item.reason?.message || String(item.reason) });
  });
  return { responses, errors };
}

async function saveLead(lead) {
  const result = await db.query(
    `INSERT INTO leads
       (niche_id, nome_perfil, wa_username, whatsapp, link_whatsapp, snippet, fonte_url, original_query, status)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
     WHERE NOT EXISTS (
       SELECT 1 FROM leads
        WHERE niche_id = $1
          AND (($4::text IS NOT NULL AND whatsapp = $4) OR (fonte_url = $7 AND $7 <> ''))
     )
     RETURNING id`,
    [lead.nicheId, lead.nomePerfil, lead.waUsername, lead.whatsapp, lead.linkWhatsapp,
      lead.snippet, lead.fonteUrl, lead.originalQuery, lead.status]
  );
  return result.rows.length > 0;
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function discover(nicheId, options = {}) {
  const startedAt = Date.now();
  const config = await loadConfig(nicheId);
  if (!config.keywords.length) throw new Error('Cadastre ao menos uma palavra-chave principal.');

  const maxQueries = Math.min(30, Math.max(1, Number(options.maxQueries) || 18));
  const concurrency = Math.min(6, Math.max(1, Number(options.concurrency) || 4));
  const queries = buildQueries(config.keywords, config.contextTerms, maxQueries, config.niche.location || '');
  const seenUrls = new Set();
  const leads = [];
  const rejected = {};
  const diagnostics = [];
  let providerErrors = 0;
  let rawResults = 0;

  console.log(`[discovery] inicio niche=${nicheId} keywords=${config.keywords.length} queries=${queries.length} concurrency=${concurrency}`);

  const queryResults = await mapConcurrent(queries, concurrency, async (query, index) => {
    const providerResult = await executeProviders(query, config);
    providerErrors += providerResult.errors.length;
    const normalized = [];
    for (const item of providerResult.responses) {
      const found = normalizeResults(item.response, query);
      normalized.push(...found);
      console.log(`[discovery] q=${index + 1}/${queries.length} provider=${item.provider} results=${found.length} query=${JSON.stringify(query)}`);
    }
    for (const error of providerResult.errors) {
      console.warn(`[discovery] q=${index + 1}/${queries.length} provider=${error.provider} erro=${error.error}`);
    }
    return { query, normalized, errors: providerResult.errors.length };
  });

  for (const item of queryResults) {
    rawResults += item.normalized.length;
    let acceptedForQuery = 0;
    for (const raw of item.normalized) {
      if (!raw.link || seenUrls.has(raw.link)) continue;
      seenUrls.add(raw.link);
      const converted = toLead(raw, nicheId);
      if (!converted.lead) {
        rejected[converted.reason] = (rejected[converted.reason] || 0) + 1;
        continue;
      }
      acceptedForQuery += 1;
      leads.push(converted.lead);
    }
    diagnostics.push({ query: item.query, raw: item.normalized.length, accepted: acceptedForQuery, providerErrors: item.errors });
  }

  let inserted = 0;
  for (const lead of leads) {
    if (await saveLead(lead)) inserted += 1;
  }

  const result = {
    nicheId,
    durationMs: Date.now() - startedAt,
    queries: queries.length,
    rawResults,
    candidates: leads.length,
    inserted,
    duplicates: leads.length - inserted,
    providerErrors,
    rejected,
    diagnostics,
  };
  console.log(`[discovery] fim niche=${nicheId} durationMs=${result.durationMs} raw=${rawResults} candidates=${leads.length} inserted=${inserted} providerErrors=${providerErrors} rejected=${JSON.stringify(rejected)}`);
  return result;
}

module.exports = {
  discover,
  buildQueries,
  extractWhatsapp,
  cleanProfileName,
  normalizeResults,
  toLead,
};
