const db = require('../config/db');

const ADVANCED_STAGES = new Set([
  'contacted',
  'responded',
  'interested',
  'converted',
  'discarded',
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

function includesAny(haystack, terms) {
  if (!haystack || !terms.length) return false;
  return terms.some((term) => haystack.includes(normalizeText(term)));
}

function computeScore({ lead, campaign, keywords }) {
  const breakdown = [];
  let score = 0;

  const add = (points, reason) => {
    score += points;
    breakdown.push({ points, reason });
  };

  if (lead.whatsapp) add(35, 'WhatsApp disponível');
  if (lead.email) add(10, 'E-mail disponível');

  const name = String(lead.nome_perfil || '').trim();
  if (name && normalizeText(name) !== 'desconhecido') {
    add(10, 'Perfil identificado');
  }

  if (lead.enrichment_status === 'enriquecido') {
    add(15, 'Dados enriquecidos');
  } else if (lead.descricao_extra) {
    add(5, 'Descrição adicional disponível');
  }

  const source = normalizeText(lead.fonte_url);
  if (
    source.includes('instagram.com') ||
    source.includes('facebook.com') ||
    source.includes('tiktok.com') ||
    source.includes('google.com/maps') ||
    source.includes('maps.google')
  ) {
    add(5, 'Presença digital identificada');
  }

  const haystack = normalizeText([
    lead.nome_perfil,
    lead.snippet,
    lead.descricao_extra,
    lead.original_query,
    lead.fonte_url,
  ].filter(Boolean).join(' '));

  const principalKeywords = keywords
    .filter((item) => item.kind === 'nicho')
    .map((item) => item.term)
    .filter(Boolean);

  if (includesAny(haystack, principalKeywords)) {
    add(15, 'Aderência aos termos principais da campanha');
  }

  const locationTokens = tokenize(campaign.location);
  if (locationTokens.length && locationTokens.some((token) => haystack.includes(token))) {
    add(10, 'Indício de aderência à localização');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    breakdown,
  };
}

async function loadCampaign(nicheId) {
  const [campaignResult, keywordResult] = await Promise.all([
    db.query(
      `SELECT id, name, description, location, offer, target_audience, objective,
              min_lead_score, campaign_status
         FROM niches
        WHERE id = $1`,
      [nicheId]
    ),
    db.query(
      `SELECT term, kind
         FROM keywords
        WHERE niche_id = $1 AND active = true`,
      [nicheId]
    ),
  ]);

  const campaign = campaignResult.rows[0];
  if (!campaign) throw new Error('Campanha não encontrada.');

  return {
    campaign,
    keywords: keywordResult.rows,
  };
}

async function scoreBatch(nicheId, options = {}) {
  const { campaign, keywords } = await loadCampaign(nicheId);
  const batchSize = Math.min(500, Math.max(1, Number(options.batchSize) || 200));
  const force = Boolean(options.force);

  const leads = (await db.query(
    `SELECT id, nome_perfil, whatsapp, email, snippet, fonte_url,
            original_query, descricao_extra, enrichment_status,
            funnel_stage, scored_at, updated_at
       FROM leads
      WHERE niche_id = $1
        AND ($3::boolean = true OR scored_at IS NULL OR updated_at > scored_at)
      ORDER BY created_at ASC
      LIMIT $2`,
    [nicheId, batchSize, force]
  )).rows;

  let qualified = 0;
  let belowThreshold = 0;
  let totalScore = 0;

  for (const lead of leads) {
    const calculated = computeScore({ lead, campaign, keywords });
    const isQualified = calculated.score >= Number(campaign.min_lead_score || 55);
    const nextStage = ADVANCED_STAGES.has(lead.funnel_stage)
      ? lead.funnel_stage
      : (isQualified ? 'qualified' : 'discovered');

    await db.query(
      `UPDATE leads
          SET lead_score = $1,
              score_breakdown = $2::jsonb,
              scored_at = NOW(),
              funnel_stage = $3,
              updated_at = NOW()
        WHERE id = $4 AND niche_id = $5`,
      [
        calculated.score,
        JSON.stringify({
          threshold: Number(campaign.min_lead_score || 55),
          reasons: calculated.breakdown,
        }),
        nextStage,
        lead.id,
        nicheId,
      ]
    );

    totalScore += calculated.score;
    if (isQualified) qualified += 1;
    else belowThreshold += 1;
  }

  return {
    nicheId,
    selected: leads.length,
    qualified,
    belowThreshold,
    threshold: Number(campaign.min_lead_score || 55),
    averageScore: leads.length ? Math.round(totalScore / leads.length) : 0,
  };
}

module.exports = {
  scoreBatch,
  computeScore,
  normalizeText,
};
