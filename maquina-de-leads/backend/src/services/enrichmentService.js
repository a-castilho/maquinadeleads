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
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('Destino privado/local bloqueado.');
  }
  return url.toString();
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i');
  return html.match(re)?.[1] || null;
}

function extractEmail(text) {
  return String(text || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || null;
}

function extractPhone(text) {
  const candidates = String(text || '').match(/(?:\+?55[\s.\-]?)?\(?\d{2}\)?[\s.\-]?9?[\s.\-]?\d{4}[\s.\-]?\d{4}/g) || [];
  for (const candidate of candidates) {
    let digits = candidate.replace(/\D/g, '');
    if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  }
  return null;
}

async function enrichBatch(nicheId, options = {}) {
  const batchSize = Math.min(50, Math.max(1, Number(options.batchSize) || 15));
  const timeout = Math.max(3000, Number(process.env.ENRICHMENT_HTTP_TIMEOUT_MS) || 15000);
  const leads = (await db.query(
    `SELECT id, fonte_url FROM leads
      WHERE niche_id = $1
        AND fonte_url IS NOT NULL
        AND (enrichment_status = 'pendente' OR enrichment_status IS NULL)
      ORDER BY created_at ASC
      LIMIT $2`,
    [nicheId, batchSize]
  )).rows;

  let enriched = 0;
  let withoutData = 0;

  for (const lead of leads) {
    let email = null;
    let description = null;
    let phone = null;
    let status = 'sem_dados';

    try {
      const safeUrl = await assertSafeUrl(lead.fonte_url);
      const response = await axios.get(safeUrl, {
        timeout,
        maxContentLength: 1024 * 1024,
        responseType: 'text',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaquinaDeLeads/1.0)' },
        maxRedirects: 3,
      });
      const html = String(response.data || '').slice(0, 1_000_000);
      description = extractMeta(html, 'og:description') || extractMeta(html, 'description') || extractMeta(html, 'og:title');
      if (description) description = description.slice(0, 500);
      email = extractEmail(html) || extractEmail(description);
      phone = extractPhone(html) || extractPhone(description);
      status = (email || phone || description) ? 'enriquecido' : 'sem_dados';
    } catch (error) {
      console.warn(`[enrichment] lead=${lead.id}: ${error.message}`);
    }

    await db.query(
      `UPDATE leads SET
         email = $1,
         descricao_extra = $2,
         whatsapp = COALESCE(whatsapp, $3),
         enrichment_status = $4,
         enriched_at = NOW(),
         updated_at = NOW()
       WHERE id = $5 AND niche_id = $6`,
      [email, description, phone, status, lead.id, nicheId]
    );

    if (status === 'enriquecido') enriched += 1;
    else withoutData += 1;
  }

  return { nicheId, selected: leads.length, enriched, withoutData };
}

module.exports = { enrichBatch, extractEmail, extractPhone, assertSafeUrl };
