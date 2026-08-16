const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');
const jobService = require('../services/jobService');

async function start(req, res) {
  const { nicheId } = req.params;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }

    const campaignResult = await db.query(
      `SELECT id, campaign_status FROM niches WHERE id = $1`,
      [nicheId]
    );
    const campaign = campaignResult.rows[0];
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
    if (['paused', 'completed', 'failed'].includes(campaign.campaign_status)) {
      return res.status(409).json({ error: `Campanha em estado "${campaign.campaign_status}" não aceita preparação.` });
    }

    const keywordResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM keywords
        WHERE niche_id = $1 AND kind = 'nicho' AND active = true`,
      [nicheId]
    );
    if (keywordResult.rows[0].total === 0) {
      return res.status(400).json({ error: 'Cadastre ao menos uma palavra-chave principal antes da preparação.' });
    }

    const active = await db.query(
      `SELECT id, job_type, status
         FROM native_jobs
        WHERE niche_id = $1
          AND job_type IN ('campaign.discover_leads','campaign.enrich_leads','campaign.score_leads')
          AND status IN ('pending','processing','retry')
        ORDER BY created_at DESC
        LIMIT 1`,
      [nicheId]
    );
    if (active.rows[0]) {
      return res.status(409).json({
        error: 'Já existe uma etapa de preparação em andamento para esta campanha.',
        job: active.rows[0],
      });
    }

    const job = await jobService.enqueueUnique({
      nicheId,
      jobType: 'campaign.discover_leads',
      payload: {
        maxQueries: Math.min(50, Math.max(1, Number(req.body?.maxQueries) || 24)),
        autoPipeline: true,
        enrichBatchSize: Math.min(50, Math.max(1, Number(req.body?.enrichBatchSize) || 25)),
        scoreBatchSize: Math.min(500, Math.max(1, Number(req.body?.scoreBatchSize) || 500)),
      },
      maxAttempts: 3,
    });

    if (!job) {
      return res.status(409).json({ error: 'Já existe uma descoberta em andamento para esta campanha.' });
    }

    await db.query(
      `UPDATE niches
          SET campaign_status = CASE WHEN campaign_status = 'draft' THEN 'preparing' ELSE campaign_status END,
              updated_at = NOW()
        WHERE id = $1`,
      [nicheId]
    );

    console.log(`[native-pipeline] niche=${nicheId} preparation=start job=${job.id}`);
    return res.status(202).json({
      message: 'Preparação iniciada: descoberta → enriquecimento → scoring.',
      job,
      pipeline: ['campaign.discover_leads', 'campaign.enrich_leads', 'campaign.score_leads'],
    });
  } catch (error) {
    console.error(`[native-pipeline] niche=${nicheId} preparation=start error=${error.message}`);
    return res.status(500).json({ error: 'Erro ao iniciar preparação automática.', details: error.message });
  }
}

module.exports = { start };
