const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');

async function recover(req, res) {
  const { nicheId } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Campanha não encontrada.' });
  }

  const staleMinutes = Math.max(
    1,
    Number(req.body?.staleMinutes) || Number(process.env.JOB_STALE_MINUTES) || 3
  );

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const stale = await client.query(
      `SELECT id
         FROM native_jobs
        WHERE niche_id = $1
          AND status = 'processing'
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
      `UPDATE native_job_executions
          SET status = 'failed',
              finished_at = NOW(),
              error_message = COALESCE(error_message, 'Execução recuperada manualmente após expiração do lock.')
        WHERE job_id = ANY($1::uuid[])
          AND status = 'processing'`,
      [ids]
    );

    const recovered = await client.query(
      `UPDATE native_jobs
          SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'retry' END,
              run_at = CASE WHEN attempts >= max_attempts THEN run_at ELSE NOW() END,
              completed_at = CASE WHEN attempts >= max_attempts THEN NOW() ELSE NULL END,
              last_error = 'Job recuperado após ficar travado em processing.',
              locked_at = NULL,
              locked_by = NULL
        WHERE id = ANY($1::uuid[])
        RETURNING id, niche_id, job_type, status, attempts, max_attempts, last_error`,
      [ids]
    );

    await client.query('COMMIT');

    console.warn(
      `[native-recovery] niche=${nicheId} recovered=${recovered.rows.length} staleMinutes=${staleMinutes} ` +
      `jobs=${JSON.stringify(recovered.rows)}`
    );

    return res.json({
      nicheId,
      staleMinutes,
      recovered: recovered.rows,
      recoveredCount: recovered.rows.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[native-recovery] niche=${nicheId} erro=${error.message}`);
    return res.status(500).json({ error: 'Erro ao recuperar jobs travados.', details: error.message });
  } finally {
    client.release();
  }
}

module.exports = { recover };
