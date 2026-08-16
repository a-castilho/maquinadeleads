const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');
const jobService = require('../services/jobService');

async function ensureOwnership(nicheId, userId, res) {
  if (!(await assertNicheOwnership(nicheId, userId))) {
    res.status(404).json({ error: 'Campanha não encontrada.' });
    return false;
  }
  return true;
}

async function getCampaign(nicheId) {
  const result = await db.query(
    `SELECT id, name, description, location, offer, target_audience, objective,
            campaign_status, min_lead_score, active
       FROM niches
      WHERE id = $1`,
    [nicheId]
  );
  return result.rows[0] || null;
}

function ensurePreparationAllowed(campaign, res) {
  if (!campaign) {
    res.status(404).json({ error: 'Campanha não encontrada.' });
    return false;
  }
  if (['paused', 'completed', 'failed'].includes(campaign.campaign_status)) {
    res.status(409).json({
      error: `Campanha em estado "${campaign.campaign_status}" não aceita novos jobs de preparação.`,
    });
    return false;
  }
  return true;
}

async function findActiveJob(nicheId, jobType) {
  const result = await db.query(
    `SELECT id, status, created_at
       FROM native_jobs
      WHERE niche_id = $1
        AND job_type = $2
        AND status IN ('pending', 'processing', 'retry')
      ORDER BY created_at DESC
      LIMIT 1`,
    [nicheId, jobType]
  );
  return result.rows[0] || null;
}

async function enqueueUnique({ nicheId, jobType, payload, maxAttempts, conflictMessage, res }) {
  const activeJob = await findActiveJob(nicheId, jobType);
  if (activeJob) {
    res.status(409).json({ error: conflictMessage, job: activeJob });
    return null;
  }
  return jobService.enqueue({ nicheId, jobType, payload, maxAttempts });
}

async function markPreparing(nicheId) {
  await db.query(
    `UPDATE niches
        SET campaign_status = CASE WHEN campaign_status = 'draft' THEN 'preparing' ELSE campaign_status END,
            updated_at = NOW()
      WHERE id = $1`,
    [nicheId]
  );
}

async function startDiscovery(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const campaign = await getCampaign(nicheId);
  if (!ensurePreparationAllowed(campaign, res)) return;

  const maxQueries = Math.min(50, Math.max(1, Number(req.body?.maxQueries) || 50));
  const keywordCount = await db.query(
    `SELECT COUNT(*)::int AS total FROM keywords
      WHERE niche_id = $1 AND kind = 'nicho' AND active = true`,
    [nicheId]
  );
  if (keywordCount.rows[0].total === 0) {
    return res.status(400).json({ error: 'Cadastre ao menos uma palavra-chave principal antes da descoberta.' });
  }

  const job = await enqueueUnique({
    nicheId,
    jobType: 'campaign.discover_leads',
    payload: { maxQueries },
    maxAttempts: 3,
    conflictMessage: 'Já existe uma descoberta em andamento para esta campanha.',
    res,
  });
  if (!job) return;

  await markPreparing(nicheId);
  res.status(202).json({ job });
}

async function startEnrichment(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const campaign = await getCampaign(nicheId);
  if (!ensurePreparationAllowed(campaign, res)) return;

  const batchSize = Math.min(50, Math.max(1, Number(req.body?.batchSize) || 15));
  const pending = await db.query(
    `SELECT COUNT(*)::int AS total FROM leads
      WHERE niche_id = $1
        AND fonte_url IS NOT NULL
        AND (enrichment_status = 'pendente' OR enrichment_status IS NULL)`,
    [nicheId]
  );
  if (pending.rows[0].total === 0) {
    return res.status(400).json({ error: 'Não há leads pendentes para enriquecimento.' });
  }

  const job = await enqueueUnique({
    nicheId,
    jobType: 'campaign.enrich_leads',
    payload: { batchSize },
    maxAttempts: 2,
    conflictMessage: 'Já existe um enriquecimento em andamento para esta campanha.',
    res,
  });
  if (!job) return;

  await markPreparing(nicheId);
  res.status(202).json({ job });
}

async function startScoring(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const campaign = await getCampaign(nicheId);
  if (!ensurePreparationAllowed(campaign, res)) return;

  const batchSize = Math.min(500, Math.max(1, Number(req.body?.batchSize) || 200));
  const force = Boolean(req.body?.force);
  const leadCount = await db.query(
    `SELECT COUNT(*)::int AS total FROM leads WHERE niche_id = $1`,
    [nicheId]
  );
  if (leadCount.rows[0].total === 0) {
    return res.status(400).json({ error: 'Descubra leads antes de executar o scoring.' });
  }

  const job = await enqueueUnique({
    nicheId,
    jobType: 'campaign.score_leads',
    payload: { batchSize, force },
    maxAttempts: 2,
    conflictMessage: 'Já existe um scoring em andamento para esta campanha.',
    res,
  });
  if (!job) return;

  await markPreparing(nicheId);
  res.status(202).json({ job });
}

async function startSending(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const campaign = await getCampaign(nicheId);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
  if (campaign.campaign_status !== 'running') {
    return res.status(409).json({ error: 'Ative a campanha antes de enviar mensagens.' });
  }

  const batchSize = Math.min(50, Math.max(1, Number(req.body?.batchSize) || 10));
  const [template, credential, pending] = await Promise.all([
    db.query(
      `SELECT id FROM message_templates
        WHERE niche_id = $1 AND active = true
        ORDER BY created_at DESC LIMIT 1`,
      [nicheId]
    ),
    db.query(
      `SELECT id FROM credentials
        WHERE niche_id = $1 AND provider = 'evolution_api'
          AND api_key IS NOT NULL AND api_key <> ''
          AND base_url IS NOT NULL AND base_url <> ''
        LIMIT 1`,
      [nicheId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total
         FROM leads l
         JOIN niches n ON n.id = l.niche_id
        WHERE l.niche_id = $1
          AND l.status = 'pendente'
          AND l.ultima_mensagem_enviada IS NULL
          AND l.whatsapp IS NOT NULL
          AND l.lead_score >= n.min_lead_score
          AND l.funnel_stage IN ('qualified', 'ready_for_contact')`,
      [nicheId]
    ),
  ]);

  if (!template.rows[0]) return res.status(400).json({ error: 'Cadastre uma mensagem ativa antes do envio.' });
  if (!credential.rows[0]) return res.status(400).json({ error: 'Configure a Evolution API antes do envio.' });
  if (pending.rows[0].total === 0) {
    return res.status(400).json({ error: 'Não há leads qualificados pendentes para envio.' });
  }

  const job = await enqueueUnique({
    nicheId,
    jobType: 'campaign.send_messages',
    payload: { batchSize },
    maxAttempts: 2,
    conflictMessage: 'Já existe um envio em andamento para esta campanha.',
    res,
  });
  if (job) res.status(202).json({ job });
}

async function readiness(nicheId) {
  const [campaignResult, keywordResult, templateResult, credentialResult, leadResult] = await Promise.all([
    db.query(
      `SELECT id, name, description, offer, objective, campaign_status, min_lead_score
         FROM niches WHERE id = $1`,
      [nicheId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total FROM keywords
        WHERE niche_id = $1 AND kind = 'nicho' AND active = true`,
      [nicheId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total FROM message_templates
        WHERE niche_id = $1 AND active = true`,
      [nicheId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total FROM credentials
        WHERE niche_id = $1 AND provider = 'evolution_api'
          AND api_key IS NOT NULL AND api_key <> ''
          AND base_url IS NOT NULL AND base_url <> ''`,
      [nicheId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE scored_at IS NOT NULL)::int AS scored,
              COUNT(*) FILTER (WHERE lead_score >= (SELECT min_lead_score FROM niches WHERE id = $1))::int AS qualified
         FROM leads
        WHERE niche_id = $1`,
      [nicheId]
    ),
  ]);

  const campaign = campaignResult.rows[0];
  const leads = leadResult.rows[0];
  return {
    campaign,
    hasKeywords: keywordResult.rows[0].total > 0,
    hasMessage: templateResult.rows[0].total > 0,
    hasEvolution: credentialResult.rows[0].total > 0,
    hasLeads: leads.total > 0,
    hasScoredLeads: leads.scored > 0,
    hasQualifiedLeads: leads.qualified > 0,
    leadCounts: leads,
  };
}

async function activate(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const state = await readiness(nicheId);
  const campaign = state.campaign;
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
  if (campaign.campaign_status === 'paused') {
    return res.status(409).json({ error: 'Use retomar para uma campanha pausada.' });
  }
  if (['completed', 'failed'].includes(campaign.campaign_status)) {
    return res.status(409).json({ error: 'Esta campanha não pode ser ativada neste estado.' });
  }

  const profileComplete = Boolean(
    campaign.name && (campaign.description || campaign.offer) && campaign.objective
  );
  const missing = [];
  if (!profileComplete) missing.push('perfil da campanha');
  if (!state.hasKeywords) missing.push('palavras-chave');
  if (!state.hasMessage) missing.push('mensagem ativa');
  if (!state.hasLeads) missing.push('leads para revisão');
  if (!state.hasScoredLeads) missing.push('scoring dos leads');
  if (!state.hasQualifiedLeads) missing.push('lead qualificado acima do score mínimo');
  if (!state.hasEvolution) missing.push('Evolution API');

  if (missing.length) {
    return res.status(400).json({
      error: `Campanha ainda não está pronta. Falta: ${missing.join(', ')}.`,
      readiness: state,
    });
  }

  const activeJob = await findActiveJob(nicheId, 'campaign.process_batch');
  if (activeJob) {
    return res.status(409).json({ error: 'Já existe um processamento da campanha em andamento.', job: activeJob });
  }

  await db.query(
    `UPDATE niches
        SET campaign_status = 'running', active = true, updated_at = NOW()
      WHERE id = $1`,
    [nicheId]
  );

  const job = await jobService.enqueue({
    nicheId,
    jobType: 'campaign.process_batch',
    payload: {
      scoreBatchSize: Math.min(500, Math.max(1, Number(req.body?.scoreBatchSize) || 500)),
      sendBatchSize: Math.min(50, Math.max(1, Number(req.body?.sendBatchSize) || 25)),
    },
    maxAttempts: 2,
  });

  res.status(202).json({
    message: 'Campanha ativada. Scoring e primeiro lote de contatos foram enfileirados.',
    campaignStatus: 'running',
    job,
  });
}

async function pause(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const result = await db.query(
    `UPDATE niches
        SET campaign_status = 'paused', updated_at = NOW()
      WHERE id = $1 AND campaign_status = 'running'
      RETURNING id, campaign_status`,
    [nicheId]
  );

  if (!result.rows[0]) {
    return res.status(409).json({ error: 'Somente campanhas em execução podem ser pausadas.' });
  }

  res.json({ message: 'Campanha pausada. Novos jobs não serão assumidos pelo worker.', campaign: result.rows[0] });
}

async function resume(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const result = await db.query(
    `UPDATE niches
        SET campaign_status = 'running', active = true, updated_at = NOW()
      WHERE id = $1 AND campaign_status = 'paused'
      RETURNING id, campaign_status`,
    [nicheId]
  );

  if (!result.rows[0]) {
    return res.status(409).json({ error: 'Somente campanhas pausadas podem ser retomadas.' });
  }

  res.json({ message: 'Campanha retomada.', campaign: result.rows[0] });
}

async function processBatch(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const campaign = await getCampaign(nicheId);
  if (!campaign || campaign.campaign_status !== 'running') {
    return res.status(409).json({ error: 'A campanha precisa estar em execução.' });
  }

  const job = await enqueueUnique({
    nicheId,
    jobType: 'campaign.process_batch',
    payload: {
      scoreBatchSize: Math.min(500, Math.max(1, Number(req.body?.scoreBatchSize) || 500)),
      sendBatchSize: Math.min(50, Math.max(1, Number(req.body?.sendBatchSize) || 25)),
    },
    maxAttempts: 2,
    conflictMessage: 'Já existe um processamento em andamento para esta campanha.',
    res,
  });

  if (job) res.status(202).json({ job });
}

async function list(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;
  const jobs = await jobService.listForNiche(nicheId, {
    status: req.query.status || null,
    limit: req.query.limit || 50,
  });
  res.json({ jobs });
}

async function executions(req, res) {
  const { nicheId, jobId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;
  const job = await db.query('SELECT id FROM native_jobs WHERE id = $1 AND niche_id = $2', [jobId, nicheId]);
  if (!job.rows[0]) return res.status(404).json({ error: 'Job não encontrado.' });
  const items = await jobService.getExecutions(jobId, req.query.limit || 20);
  res.json({ executions: items });
}

module.exports = {
  startDiscovery,
  startEnrichment,
  startScoring,
  startSending,
  activate,
  pause,
  resume,
  processBatch,
  list,
  executions,
};
