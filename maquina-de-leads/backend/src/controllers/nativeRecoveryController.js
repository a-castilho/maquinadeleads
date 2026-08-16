const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');

const PREPARATION_TYPES = [
  'campaign.discover_leads',
  'campaign.enrich_leads',
  'campaign.score_leads',
];

async function recover(req, res) {
  const { nicheId } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Campanha não encontrada.' });
  }

  const staleMinutes = Math.max(1, Number(req.body?.staleMinutes) || Number(process.env.JOB_STALE_MINUTES) || 3);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const stale = await client.query(
      `SELECT id FROM native_jobs
        WHERE niche_id = $1 AND status = 'processing'
          AND locked_at < NOW() - ($2::text || ' minutes')::interval
        FOR UPDATE`,
      [nicheId, staleMinutes]
    );
    if (!stale.rows.length) {
      await client.query('COMMIT');
      console.log(`[native-recovery] niche=${nicheId} recovered=0 staleMinutes=${staleMinutes}`);
      return res.json({ nicheId, staleMinutes, recovered: [], recoveredCount: 0 });
    }
    const ids = stale.rows.map((item) => item.id);
    await client.query(
      `UPDATE native_job_executions SET status = 'failed', finished_at = NOW(),
              error_message = COALESCE(error_message, 'Execução recuperada manualmente após expiração do lock.')
        WHERE job_id = ANY($1::uuid[]) AND status = 'processing'`,
      [ids]
    );
    const recovered = await client.query(
      `UPDATE native_jobs
          SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'retry' END,
              run_at = CASE WHEN attempts >= max_attempts THEN run_at ELSE NOW() END,
              completed_at = CASE WHEN attempts >= max_attempts THEN NOW() ELSE NULL END,
              last_error = 'Job recuperado após ficar travado em processing.',
              locked_at = NULL, locked_by = NULL
        WHERE id = ANY($1::uuid[])
        RETURNING id, niche_id, job_type, status, attempts, max_attempts, last_error`,
      [ids]
    );
    await client.query('COMMIT');
    console.warn(`[native-recovery] niche=${nicheId} recovered=${recovered.rows.length} staleMinutes=${staleMinutes} jobs=${JSON.stringify(recovered.rows)}`);
    return res.json({ nicheId, staleMinutes, recovered: recovered.rows, recoveredCount: recovered.rows.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[native-recovery] niche=${nicheId} erro=${error.message}`);
    return res.status(500).json({ error: 'Erro ao recuperar jobs travados.', details: error.message });
  } finally {
    client.release();
  }
}

async function restart(req, res) {
  const { nicheId } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Campanha não encontrada.' });
  }

  const maxQueries = Math.min(50, Math.max(1, Number(req.body?.maxQueries) || 24));
  const enrichBatchSize = Math.min(50, Math.max(1, Number(req.body?.enrichBatchSize) || 25));
  const scoreBatchSize = Math.min(500, Math.max(1, Number(req.body?.scoreBatchSize) || 500));
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    const campaign = (await client.query(
      `SELECT id, campaign_status FROM niches WHERE id = $1 FOR UPDATE`,
      [nicheId]
    )).rows[0];
    if (!campaign) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    if (['paused', 'completed', 'failed'].includes(campaign.campaign_status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Campanha em estado "${campaign.campaign_status}" não aceita reinício da preparação.` });
    }

    const active = await client.query(
      `SELECT id, job_type, status FROM native_jobs
        WHERE niche_id = $1
          AND job_type = ANY($2::varchar[])
          AND status IN ('pending','processing','retry')
        FOR UPDATE`,
      [nicheId, PREPARATION_TYPES]
    );
    const ids = active.rows.map((item) => item.id);
    if (ids.length) {
      await client.query(
        `UPDATE native_job_executions
            SET status = 'failed', finished_at = NOW(),
                error_message = 'Execução cancelada por reinício manual da busca.'
          WHERE job_id = ANY($1::uuid[]) AND status = 'processing'`,
        [ids]
      );
      await client.query(
        `UPDATE native_jobs
            SET status = 'cancelled', completed_at = NOW(),
                last_error = 'Cancelado por reinício manual da busca.',
                locked_at = NULL, locked_by = NULL
          WHERE id = ANY($1::uuid[])`,
        [ids]
      );
    }

    const newJob = (await client.query(
      `INSERT INTO native_jobs (niche_id, job_type, payload, max_attempts)
       VALUES ($1, 'campaign.discover_leads', $2::jsonb, 3)
       RETURNING *`,
      [nicheId, JSON.stringify({ maxQueries, autoPipeline: true, enrichBatchSize, scoreBatchSize })]
    )).rows[0];

    await client.query(
      `UPDATE niches SET campaign_status = CASE WHEN campaign_status = 'running' THEN campaign_status ELSE 'preparing' END,
                          updated_at = NOW()
        WHERE id = $1`,
      [nicheId]
    );
    await client.query('COMMIT');

    console.warn(`[native-restart] niche=${nicheId} cancelled=${ids.length} newJob=${newJob.id}`);
    return res.status(202).json({
      message: 'Busca reiniciada. A preparação anterior foi cancelada e uma nova descoberta foi enfileirada.',
      cancelledCount: ids.length,
      cancelledJobs: active.rows,
      job: newJob,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[native-restart] niche=${nicheId} error=${error.message}`);
    return res.status(500).json({ error: 'Erro ao reiniciar busca.', details: error.message });
  } finally {
    client.release();
  }
}

module.exports = { recover, restart };
