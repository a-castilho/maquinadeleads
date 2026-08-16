const axios = require('axios');
const db = require('../config/db');

const VALID_DDDS = new Set([
  11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,
  41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,
  71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99,
]);

const BLACKLIST_DOMAINS = ['amazon.', 'microsoft.', 'youtube.com', 'cinemark.', 'thehill.com', 'google.'];
const BLACKLIST_TITLES = [
  'link to', 'quanto custa', 'como colocar', 'grupo', 'festas em', 'tudo para',
  'olx', 'professor', 'quarteirão', 'playlist', 'oferta', 'dicas', 'como ativar',
  'resgate de um comercial', 'olha só que massa',
];
const DEFAULT_CONTEXT = ['whatsapp', 'contato', 'telefone', 'wa.me'];
const SITES = ['site:instagram.com', 'site:facebook.com', 'site:linktr.ee', 'site:tiktok.com'];

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
  const raw = String(title).trim();
  const lower = raw.toLowerCase();
  if (raw.length > 60 || raw.includes('...') || lower.includes('video') || lower.includes('posts/')) {
    return 'Desconhecido';
  }

  const name = raw
    .replace(/• Instagram photos and videos/gi, '')
    .replace(/Instagram/gi, '')
    .replace(/Facebook/gi, '')
    .replace(/Link to (instagram|facebook)\.com/gi, '')
    .split('|')[0]
    .split('-')[0]
    .split('(')[0]
    .trim();

  return name.length > 2 ? name : 'Desconhecido';
}

function sourceCategory(url) {
  const value = String(url || '').toLowerCase();
  if (value.includes('instagram.com')) return 'instagram';
  if (value.includes('facebook.com')) return 'facebook';
  if (value.includes('tiktok.com')) return 'tiktok';
  if (value.includes('google.com/maps') || value.includes('maps.google')) return 'google_maps';
  return 'outros';
}

function buildQueries(keywords, contextTerms, maxQueries = 50) {
  const contexts = contextTerms.length ? contextTerms : DEFAULT_CONTEXT;
  const queries = [];

  for (const keyword of keywords) {
    const cleanKeyword = String(keyword || '').replace(/^["']+|["']+$/g, '').trim();
    if (!cleanKeyword) continue;
    for (const site of SITES) {
      for (const context of contexts) {
        queries.push(`"${cleanKeyword}" ${context} ${site}`.trim());
        if (queries.length >= maxQueries) return queries;
      }
    }
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
        snippet: place.address || place.category || '',
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
  if (!link) return null;
  if (BLACKLIST_DOMAINS.some((domain) => link.toLowerCase().includes(domain))) return null;
  if (BLACKLIST_TITLES.some((term) => title.toLowerCase().includes(term))) return null;

  const whatsapp = extractWhatsapp(`${title} ${snippet} ${link}`);
  const name = cleanProfileName(title);
  if (name === 'Desconhecido' && !whatsapp) return null;

  const waUsernameMatch = link.match(/(?:wa\.me\/|phone=)(\d{10,15})/i);
  return {
    nicheId,
    nomePerfil: name,
    waUsername: waUsernameMatch ? waUsernameMatch[1] : null,
    whatsapp,
    linkWhatsapp: whatsapp ? `https://wa.me/${whatsapp}` : null,
    snippet: snippet.slice(0, 300),
    fonteUrl: link,
    fonteCategoria: sourceCategory(link),
    originalQuery: raw.query || '',
    status: whatsapp ? 'pendente' : 'sem_telefone',
  };
}

async function loadConfig(nicheId) {
  const [nicheResult, keywordResult, credentialResult] = await Promise.all([
    db.query('SELECT * FROM niches WHERE id = $1', [nicheId]),
    db.query('SELECT term, kind FROM keywords WHERE niche_id = $1 AND active = true', [nicheId]),
    db.query('SELECT * FROM credentials WHERE niche_id = $1', [nicheId]),
  ]);

  const niche = nicheResult.rows[0];
  if (!niche) throw new Error('Nicho não encontrado.');

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
  const serper = config.credentials.serper;
  const timeout = Math.max(2000, Number(process.env.DISCOVERY_HTTP_TIMEOUT_MS) || 10000);

  if (serper?.api_key) {
    const headers = { 'X-API-KEY': serper.api_key, 'Content-Type': 'application/json' };
    requests.push(axios.post('https://google.serper.dev/search', { q: query }, { headers, timeout }));
    requests.push(axios.post('https://google.serper.dev/maps', { q: query }, { headers, timeout }));
  }

  const searxngUrl = process.env.SEARXNG_URL || 'http://searxng:8080/search';
  if (searxngUrl) {
    requests.push(axios.get(searxngUrl, { params: { q: query, format: 'json' }, timeout }));
  }

  const robotUrl = process.env.ROBO_PYTHON_URL;
  if (robotUrl) {
    const base = robotUrl.replace(/\/$/, '');
    requests.push(axios.post(`${base}/search`, { q: query }, { timeout }));
    requests.push(axios.post(`${base}/maps`, { q: query }, { timeout }));
  }

  if (requests.length === 0) {
    throw new Error('Nenhum provedor de descoberta configurado. Configure Serper, SearXNG ou ROBO_PYTHON_URL.');
  }

  const settled = await Promise.allSettled(requests);
  const successful = settled.filter((item) => item.status === 'fulfilled').map((item) => item.value);
  return {
    responses: successful,
    providerErrors: settled.length - successful.length,
  };
}

async function saveLead(lead) {
  const result = await db.query(
    `INSERT INTO leads
       (niche_id, nome_perfil, wa_username, whatsapp, link_whatsapp, snippet, fonte_url, original_query, status)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
     WHERE NOT EXISTS (
       SELECT 1
         FROM leads
        WHERE niche_id = $1
          AND (($4::text IS NOT NULL AND whatsapp = $4) OR (fonte_url = $7 AND $7 <> ''))
     )
     RETURNING id`,
    [
      lead.nicheId,
      lead.nomePerfil,
      lead.waUsername,
      lead.whatsapp,
      lead.linkWhatsapp,
      lead.snippet,
      lead.fonteUrl,
      lead.originalQuery,
      lead.status,
    ]
  );
  return result.rows.length > 0;
}

async function discover(nicheId, options = {}) {
  const config = await loadConfig(nicheId);
  if (config.keywords.length === 0) throw new Error('Cadastre ao menos uma palavra-chave de nicho.');

  const maxQueries = Math.min(50, Math.max(1, Number(options.maxQueries) || 50));
  const queries = buildQueries(config.keywords, config.contextTerms, maxQueries);
  const seenUrls = new Set();
  const leads = [];
  let providerErrors = 0;

  for (const query of queries) {
    const providerResult = await executeProviders(query, config);
    providerErrors += providerResult.providerErrors;

    for (const response of providerResult.responses) {
      for (const raw of normalizeResults(response, query)) {
        if (!raw.link || seenUrls.has(raw.link)) continue;
        seenUrls.add(raw.link);
        const lead = toLead(raw, nicheId);
        if (lead) leads.push(lead);
      }
    }
  }

  let inserted = 0;
  for (const lead of leads) {
    if (await saveLead(lead)) inserted += 1;
  }

  return {
    nicheId,
    queries: queries.length,
    candidates: leads.length,
    inserted,
    duplicates: leads.length - inserted,
    providerErrors,
  };
}

module.exports = {
  discover,
  buildQueries,
  extractWhatsapp,
  cleanProfileName,
};
