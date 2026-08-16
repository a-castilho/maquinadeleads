const dns = require('dns').promises;
const net = require('net');
const axios = require('axios');
const db = require('../config/db');

function isPrivateIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  const normalized = ip.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

async function assertSafeUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL não permitida.');
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error('Destino privado/local bloqueado.');
  return url.toString();
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i');
  return html.match(re)?.[1] || null;
}
function extractEmail(text) { return String(text || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || null; }
function extractPhone(text) {
  const candidates = String(text || '').match(/(?:\+?55[\s.\-]?)?\(?\d{2}\)?[\s.\-]?9?[\s.\-]?\d{4}[\s.\-]?\d{4}/g) || [];
  for (const candidate of candidates) {
    let digits = candidate.replace(/\D/g, '');
    if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  }
  return null;
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
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, worker));
  return results;
}

async function enrichOne(lead, nicheId, timeout) {
  let email = null;
  let description = null;
  let phone = null;
  let resultStatus = 'sem_dados';
  let persistStatus = 'sem_dados';
  let errorMessage = null;
  try {
    const safeUrl = await assertSafeUrl(lead.fonte_url);
    const response = await axios.get(safeUrl, {
      timeout,
      maxContentLength: 1024 * 1024,
      responseType: 'text',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaquinaDeLeads/1.0; +lead-enrichment)' },
      maxRedirects: 3,
      validateStatus: (statusCode) => statusCode >= 200 && statusCode < 400,
    });
    const html = String(response.data || '').slice(0, 1_000_000);
    description = extractMeta(html, 'og:description') || extractMeta(html, 'description') || extractMeta(html, 'og:title');
    if (description) description = description.slice(0, 500);
    email = extractEmail(html) || extractEmail(description);
    phone = extractPhone(html) || extractPhone(description);
    resultStatus = (email || phone || description) ? 'enriquecido' : 'sem_dados';
    persistStatus = resultStatus;
  } catch (error) {
    errorMessage = String(error.message || error).slice(0, 500);
    resultStatus = 'falhou';
    persistStatus = 'pendente';
  }

  await db.query(
    `UPDATE leads SET
       email = COALESCE($1, email),
       descricao_extra = COALESCE($2, descricao_extra),
       whatsapp = COALESCE(whatsapp, $3),
       enrichment_status = $4,
       observacao = CASE WHEN $5::text IS NOT NULL THEN LEFT(COALESCE(observacao || ' | ', '') || 'Enrichment: ' || $5, 2000) ELSE observacao END,
       enriched_at = CASE WHEN $4 = 'pendente' THEN enriched_at ELSE NOW() END,
       updated_at = NOW()
     WHERE id = $6 AND niche_id = $7`,
    [email, description, phone, persistStatus, errorMessage, lead.id, nicheId]
  );

  console.log(`[enrichment] lead=${lead.id} status=${resultStatus} persisted=${persistStatus} email=${Boolean(email)} phone=${Boolean(phone)}${errorMessage ? ` error=${errorMessage}` : ''}`);
  return { status: resultStatus, email: Boolean(email), phone: Boolean(phone), error: errorMessage };
}

async function enrichBatch(nicheId, options = {}) {
  const startedAt = Date.now();
  const batchSize = Math.min(50, Math.max(1, Number(options.batchSize) || 20));
  const concurrency = Math.min(8, Math.max(1, Number(options.concurrency) || 5));
  const timeout = Math.min(8000, Math.max(2500, Number(process.env.ENRICHMENT_HTTP_TIMEOUT_MS) || 6000));
  const forceRetry = Boolean(options.forceRetry);

  const leads = (await db.query(
    `SELECT id, fonte_url FROM leads
      WHERE niche_id = $1 AND fonte_url IS NOT NULL
        AND (
          enrichment_status = 'pendente' OR enrichment_status IS NULL
          OR ($3::boolean = true AND enrichment_status IN ('falhou','sem_dados'))
        )
      ORDER BY created_at ASC LIMIT $2`,
    [nicheId, batchSize, forceRetry]
  )).rows;

  console.log(`[enrichment] inicio niche=${nicheId} selected=${leads.length} concurrency=${concurrency} timeout=${timeout}ms forceRetry=${forceRetry}`);
  const results = await mapConcurrent(leads, concurrency, (lead) => enrichOne(lead, nicheId, timeout));
  const summary = {
    nicheId,
    selected: leads.length,
    enriched: results.filter((r) => r.status === 'enriquecido').length,
    withoutData: results.filter((r) => r.status === 'sem_dados').length,
    failed: results.filter((r) => r.status === 'falhou').length,
    withEmail: results.filter((r) => r.email).length,
    withPhone: results.filter((r) => r.phone).length,
    durationMs: Date.now() - startedAt,
  };
  console.log(`[enrichment] fim ${JSON.stringify(summary)}`);
  return summary;
}

module.exports = { enrichBatch, extractEmail, extractPhone, assertSafeUrl };
