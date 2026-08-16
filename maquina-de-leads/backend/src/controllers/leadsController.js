const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');

const FUNNEL_STAGES = new Set([
  'discovered',
  'qualified',
  'ready_for_contact',
  'contacted',
  'responded',
  'interested',
  'converted',
  'discarded',
]);

async function list(req, res) {
  const { nicheId } = req.params;
  const { status, search, fonte, funnelStage, minScore } = req.query;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a esta campanha.' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
    const offset = (page - 1) * pageSize;

    const conditions = ['l.niche_id = $1'];
    const params = [nicheId];

    if (status) {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }
    if (funnelStage && FUNNEL_STAGES.has(funnelStage)) {
      params.push(funnelStage);
      conditions.push(`l.funnel_stage = $${params.length}`);
    }
    if (minScore !== undefined && minScore !== '') {
      const parsed = Math.min(100, Math.max(0, Number(minScore) || 0));
      params.push(parsed);
      conditions.push(`COALESCE(l.lead_score, 0) >= $${params.length}`);
    }
    if (fonte) {
      params.push(`%${fonte}%`);
      conditions.push(`(l.fonte_url ILIKE $${params.length} OR l.source_category ILIKE $${params.length})`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        l.nome_perfil ILIKE $${params.length}
        OR l.phone ILIKE $${params.length}
        OR l.whatsapp ILIKE $${params.length}
        OR l.email ILIKE $${params.length}
        OR l.snippet ILIKE $${params.length}
        OR l.descricao_extra ILIKE $${params.length}
      )`);
    }

    const whereClause = conditions.join(' AND ');

    const [result, countResult, sourcesResult] = await Promise.all([
      db.query(
        `SELECT l.*,
          n.name AS niche_name,
          n.min_lead_score,
          EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 3600 AS horas_desde_criacao
         FROM leads l
         LEFT JOIN niches n ON n.id = l.niche_id
         WHERE ${whereClause}
         ORDER BY COALESCE(l.lead_score, -1) DESC, l.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total FROM leads l WHERE ${whereClause}`,
        params
      ),
      db.query(
        `SELECT DISTINCT COALESCE(NULLIF(source_category, ''), fonte_url) AS fonte
           FROM leads
          WHERE niche_id = $1
            AND COALESCE(NULLIF(source_category, ''), fonte_url) IS NOT NULL
          LIMIT 20`,
        [nicheId]
      )
    ]);

    res.json({
      leads: result.rows,
      total: countResult.rows[0].total,
      page,
      pageSize,
      totalPages: Math.ceil(countResult.rows[0].total / pageSize),
      fontes: sourcesResult.rows.map((row) => row.fonte),
    });
  } catch (err) {
    console.error('[leads.list] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao listar leads.' });
  }
}

async function getOne(req, res) {
  const { nicheId, id } = req.params;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a esta campanha.' });
    }

    const result = await db.query(
      `SELECT l.*,
              n.name AS niche_name,
              n.min_lead_score,
              o.status AS last_message_status,
              o.sent_at AS last_message_sent_at,
              o.last_error AS last_message_error
         FROM leads l
         LEFT JOIN niches n ON n.id = l.niche_id
         LEFT JOIN LATERAL (
           SELECT status, sent_at, last_error
             FROM native_message_outbox
            WHERE lead_id = l.id
            ORDER BY created_at DESC
            LIMIT 1
         ) o ON true
        WHERE l.id = $1 AND l.niche_id = $2
        LIMIT 1`,
      [id, nicheId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    res.json({ lead: result.rows[0] });
  } catch (err) {
    console.error('[leads.getOne] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao buscar lead.' });
  }
}

async function update(req, res) {
  const { nicheId, id } = req.params;
  const { nome_perfil, phone, whatsapp, status, observacao, funnelStage } = req.body;

  if (funnelStage !== undefined && !FUNNEL_STAGES.has(funnelStage)) {
    return res.status(400).json({ error: 'Etapa de funil inválida.' });
  }

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a esta campanha.' });
    }

    const result = await db.query(
      `UPDATE leads SET
         nome_perfil = COALESCE($1, nome_perfil),
         phone = COALESCE($2, phone),
         whatsapp = COALESCE($3, whatsapp),
         status = COALESCE($4, status),
         observacao = COALESCE($5, observacao),
         funnel_stage = COALESCE($6, funnel_stage),
         updated_at = NOW()
       WHERE id = $7 AND niche_id = $8
       RETURNING *`,
      [nome_perfil, phone, whatsapp, status, observacao, funnelStage, id, nicheId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    res.json({ lead: result.rows[0] });
  } catch (err) {
    console.error('[leads.update] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar lead.' });
  }
}

async function remove(req, res) {
  const { nicheId, id } = req.params;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a esta campanha.' });
    }

    await db.query('DELETE FROM leads WHERE id = $1 AND niche_id = $2', [id, nicheId]);
    res.status(204).send();
  } catch (err) {
    console.error('[leads.remove] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao remover lead.' });
  }
}

async function clearNicheLeads(req, res) {
  const { nicheId } = req.params;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a esta campanha.' });
    }

    const result = await db.query('DELETE FROM leads WHERE niche_id = $1', [nicheId]);

    res.json({
      success: true,
      message: `${result.rowCount} leads removidos da campanha com sucesso.`,
      deletedCount: result.rowCount,
    });
  } catch (err) {
    console.error('[leads.clearNicheLeads] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao limpar leads da campanha.' });
  }
}

async function stats(req, res) {
  const { nicheId } = req.params;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a esta campanha.' });
    }

    const [statusResult, funnelResult, scoreResult, timelineResult, fontesResult] = await Promise.all([
      db.query(
        `SELECT status, COUNT(*)::int AS total
           FROM leads
          WHERE niche_id = $1
          GROUP BY status`,
        [nicheId]
      ),
      db.query(
        `SELECT funnel_stage, COUNT(*)::int AS total
           FROM leads
          WHERE niche_id = $1
          GROUP BY funnel_stage
          ORDER BY funnel_stage`,
        [nicheId]
      ),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE scored_at IS NOT NULL)::int AS scored,
                COALESCE(ROUND(AVG(lead_score) FILTER (WHERE lead_score IS NOT NULL)), 0)::int AS average_score,
                MAX(lead_score)::int AS max_score,
                MIN(lead_score)::int AS min_score
           FROM leads
          WHERE niche_id = $1`,
        [nicheId]
      ),
      db.query(
        `SELECT DATE(created_at) AS data, COUNT(*)::int AS total
           FROM leads
          WHERE niche_id = $1 AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY data DESC`,
        [nicheId]
      ),
      db.query(
        `SELECT
           CASE
             WHEN source_category = 'google_maps' THEN 'Google Maps'
             WHEN source_category = 'instagram' OR fonte_url LIKE '%instagram%' THEN 'Instagram'
             WHEN source_category = 'facebook' OR fonte_url LIKE '%facebook%' THEN 'Facebook'
             WHEN source_category = 'tiktok' OR fonte_url LIKE '%tiktok%' THEN 'TikTok'
             WHEN fonte_url LIKE '%google.com/maps%' OR fonte_url LIKE '%maps.google%' THEN 'Google Maps'
             ELSE 'Outros'
           END AS fonte,
           COUNT(*)::int AS total
         FROM leads
         WHERE niche_id = $1
         GROUP BY 1`,
        [nicheId]
      ),
    ]);

    res.json({
      stats: statusResult.rows,
      funnel: funnelResult.rows,
      score: scoreResult.rows[0],
      timeline: timelineResult.rows,
      fontes: fontesResult.rows,
    });
  } catch (err) {
    console.error('[leads.stats] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
}

async function bulkUpdate(req, res) {
  const { nicheId } = req.params;
  const { ids, status, funnelStage } = req.body;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a esta campanha.' });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Envie um array de IDs.' });
    }
    if (!status && !funnelStage) {
      return res.status(400).json({ error: 'Informe status ou etapa do funil.' });
    }
    if (funnelStage && !FUNNEL_STAGES.has(funnelStage)) {
      return res.status(400).json({ error: 'Etapa de funil inválida.' });
    }

    const placeholders = ids.map((_, index) => `$${index + 4}`).join(',');
    await db.query(
      `UPDATE leads
          SET status = COALESCE($1, status),
              funnel_stage = COALESCE($2, funnel_stage),
              updated_at = NOW()
        WHERE niche_id = $3 AND id IN (${placeholders})`,
      [status || null, funnelStage || null, nicheId, ...ids]
    );

    res.json({ message: `${ids.length} leads atualizados.` });
  } catch (err) {
    console.error('[leads.bulkUpdate] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar leads em lote.' });
  }
}

module.exports = { list, getOne, update, remove, clearNicheLeads, stats, bulkUpdate };
