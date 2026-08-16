const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/db');

const SEARXNG_URL = (process.env.SEARXNG_URL || 'http://searxng:8080').replace(/\/$/, '');

function generateStrategy(campaign) {
  const base = [campaign.niche, campaign.location, campaign.offer].filter(Boolean);
  const keywords = [base.join(' '), `${campaign.niche} ${campaign.location || ''} whatsapp`.trim(), `${campaign.niche} ${campaign.location || ''} contato`.trim()];
  return {
    keywords: [...new Set(keywords)],
    approach: `Abordagem consultiva para ${campaign.niche}${campaign.location ? ` em ${campaign.location}` : ''}.`,
    criteria: ['aderência ao nicho', 'localização', 'dados de contato', 'presença digital'],
    initialMessage: `Olá {{nome}}, tudo bem? Vi seu trabalho com ${campaign.niche}. ${campaign.offer || 'Gostaria de apresentar uma oportunidade que pode fazer sentido para você.'}`,
  };
}

function extractPhone(text = '') {
  const match = String(text).match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-.\s]?\d{4}/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, '');
  return digits.length >= 10 ? (digits.startsWith('55') ? digits : `55${digits}`) : null;
}

function scoreResult(result, campaign, phone) {
  const haystack = `${result.title || ''} ${result.content || ''}`.toLowerCase();
  let score = 20;
  if (haystack.includes(campaign.niche.toLowerCase())) score += 35;
  if (campaign.location && haystack.includes(campaign.location.toLowerCase())) score += 20;
  if (phone) score += 25;
  return Math.min(score, 100);
}

async function discoverLeads(campaign) {
  const strategy = campaign.strategy && Object.keys(campaign.strategy).length ? campaign.strategy : generateStrategy(campaign);
  const collected = [];
  for (const query of (strategy.keywords || []).slice(0, 5)) {
    const { data } = await axios.get(`${SEARXNG_URL}/search`, { params: { q: query, format: 'json', language: 'pt-BR', safesearch: 1 }, timeout: 15000 });
    for (const item of (data.results || []).slice(0, 20)) {
      const phone = extractPhone(`${item.title || ''} ${item.content || ''} ${item.url || ''}`);
      const dedupeKey = crypto.createHash('sha256').update(`${phone || ''}|${item.url || ''}`).digest('hex');
      collected.push({ name: item.title || campaign.niche, phone, url: item.url || null, snippet: item.content || null, query, score: scoreResult(item, campaign, phone), dedupeKey });
    }
  }
  let inserted = 0;
  for (const lead of collected) {
    const result = await db.query(
      `INSERT INTO leads (niche_id,campaign_id,nome_perfil,whatsapp,snippet,fonte_url,original_query,score,stage,dedupe_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'descoberto',$9)
       ON CONFLICT (campaign_id,dedupe_key) WHERE campaign_id IS NOT NULL AND dedupe_key IS NOT NULL DO NOTHING RETURNING id`,
      [campaign.niche_id,campaign.id,lead.name,lead.phone,lead.snippet,lead.url,lead.query,lead.score,lead.dedupeKey]
    );
    inserted += result.rowCount;
  }
  return { found: collected.length, inserted };
}

async function runCampaign(campaignId, userId) {
  const campaign = (await db.query('SELECT * FROM campaigns WHERE id=$1 AND user_id=$2', [campaignId,userId])).rows[0];
  if (!campaign) throw Object.assign(new Error('Campanha não encontrada.'), { status: 404 });
  const existing = (await db.query("SELECT id FROM campaign_jobs WHERE campaign_id=$1 AND type='lead_discovery' AND status IN ('queued','running') LIMIT 1", [campaign.id])).rows[0];
  if (existing) return { queued: true, jobId: existing.id, duplicate: true };
  const job = (await db.query("INSERT INTO campaign_jobs (campaign_id,type,status) VALUES ($1,'lead_discovery','queued') RETURNING *", [campaign.id])).rows[0];
  await db.query("UPDATE campaigns SET status='ready' WHERE id=$1", [campaign.id]);
  return { queued: true, jobId: job.id, duplicate: false };
}

module.exports = { generateStrategy, extractPhone, discoverLeads, runCampaign };
