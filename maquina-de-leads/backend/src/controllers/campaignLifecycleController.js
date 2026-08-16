const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');

async function complete(req, res) {
  const { nicheId } = req.params;

  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Campanha não encontrada.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const campaignResult = await client.query(
      `SELECT id, campaign_status
         FROM niches
        WHERE id = $1
        FOR UPDATE`,
      [nicheId]
    );

    const campaign = campaignResult.rows[0];
    if (!campaign) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }

    if (campaign.campaign_status === 'completed') {
      await client.query('COMMIT');
      return res.json({
        message: 'Campanha já estava encerrada.',
        campaign: { id: nicheId, campaign_status: 'completed' },
        cancelledJobs: 0,
      });
    }

    const cancelled = await client.query(
      `UPDATE native_jobs
          SET status = 'cancelled',
              completed_at = NOW(),
              locked_at = NULL,
              locked_by = NULL,
              last_error = COALESCE(last_error, 'Cancelado porque a campanha foi encerrada.'),
              updated_at = NOW()
        WHERE niche_id = $1
          AND status IN ('pending', 'retry')
        RETURNING id`,
      [nicheId]
    );

    const updated = await client.query(
      `UPDATE niches
          SET campaign_status = 'completed',
              active = false,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, campaign_status, active`,
      [nicheId]
    );

    await client.query('COMMIT');

    return res.json({
      message: 'Campanha encerrada. Jobs ainda não iniciados foram cancelados.',
      campaign: updated.rows[0],
      cancelledJobs: cancelled.rowCount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[campaign.complete] Erro:', error.message);
    return res.status(500).json({ error: 'Erro ao encerrar campanha.' });
  } finally {
    client.release();
  }
}

module.exports = { complete };
