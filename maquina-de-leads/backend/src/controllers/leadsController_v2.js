const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');

async function list(req, res) {
  const { nicheId } = req.params;
  const { status, search, fonte } = req.query;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
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
    if (fonte) {
      params.push(`%${fonte}%`);
      conditions.push(`l.fonte_url ILIKE $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(l.nome_perfil ILIKE $${params.length} OR l.whatsapp ILIKE $${params.length} OR l.snippet ILIKE $${params.length})`);
    }

    const whereClause = conditions.join(' AND ');

    const [result, countResult, sourcesResult] = await Promise.all([
      db.query(
        `SELECT l.*,
          n.name as niche_name,
          EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 3600 as horas_desde_criacao
         FROM leads l
         LEFT JOIN niches n ON n.id = l.niche_id
         WHERE ${whereClause}
         ORDER BY l.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total FROM leads l WHERE ${whereClause}`,
        params
      ),
      db.query(
        `SELECT DISTINCT fonte_url FROM leads WHERE niche_id = $1 AND fonte_url IS NOT NULL LIMIT 20`,
        [nicheId]
      )
    ]);

    res.json({
      leads: result.rows,
      total: countResult.rows[0].total,
      page,
      pageSize,
      totalPages: Math.ceil(countResult.rows[0].total / pageSize),
      fontes: sourcesResult.rows.map(r => r.fonte_url)
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
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }

    const result = await db.query(
      `SELECT l.*,
        n.name as niche_name,
        a.agent_type,
        a.n8n_workflow_id,
        a.last_sync_at as workflow_last_sync
       FROM leads l
       LEFT JOIN niches n ON n.id = l.niche_id
       LEFT JOIN n8n_agents a ON a.niche_id = l.niche_id
       WHERE l.id = $1 AND l.niche_id = $2
       LIMIT 1`,
      [id, nicheId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead nao encontrado.' });
    }

    res.json({ lead: result.rows[0] });
  } catch (err) {
    console.error('[leads.getOne] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao buscar lead.' });
  }
}

async function update(req, res) {
  const { nicheId, id } = req.params;
  const { nome_perfil, whatsapp, status, observacao } = req.body;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }

    const result = await db.query(
      `UPDATE leads SET
         nome_perfil = COALESCE($1, nome_perfil),
         whatsapp = COALESCE($2, whatsapp),
         status = COALESCE($3, status),
         observacao = COALESCE($4, observacao),
         updated_at = NOW()
       WHERE id = $5 AND niche_id = $6
       RETURNING *`,
      [nome_perfil, whatsapp, status, observacao, id, nicheId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead nao encontrado.' });
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
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }

    await db.query('DELETE FROM leads WHERE id = $1 AND niche_id = $2', [id, nicheId]);
    res.status(204).send();
  } catch (err) {
    console.error('[leads.remove] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao remover lead.' });
  }
}

async function stats(req, res) {
  const { nicheId } = req.params;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }

    const [statusResult, timelineResult, fontesResult] = await Promise.all([
      db.query(
        `SELECT status, COUNT(*)::int AS total FROM leads WHERE niche_id = $1 GROUP BY status`,
        [nicheId]
      ),
      db.query(
        `SELECT DATE(created_at) as data, COUNT(*)::int as total
         FROM leads WHERE niche_id = $1 AND created_at > NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at) ORDER BY data DESC`,
        [nicheId]
      ),
      db.query(
        `SELECT
           CASE
             WHEN fonte_url LIKE '%instagram%' THEN 'Instagram'
             WHEN fonte_url LIKE '%facebook%' THEN 'Facebook'
             ELSE 'Outros'
           END as fonte,
           COUNT(*)::int as total
         FROM leads WHERE niche_id = $1 GROUP BY 1`,
        [nicheId]
      )
    ]);

    res.json({
      stats: statusResult.rows,
      timeline: timelineResult.rows,
      fontes: fontesResult.rows
    });
  } catch (err) {
    console.error('[leads.stats] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao buscar estatisticas.' });
  }
}

async function bulkUpdate(req, res) {
  const { nicheId } = req.params;
  const { ids, status } = req.body;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Envie um array de IDs.' });
    }

    const placeholders = ids.map((_, i) => `$${i + 3}`).join(',');
    await db.query(
      `UPDATE leads SET status = $1, updated_at = NOW()
       WHERE niche_id = $2 AND id IN (${placeholders})`,
      [status, nicheId, ...ids]
    );

    res.json({ message: `${ids.length} leads atualizados.` });
  } catch (err) {
    console.error('[leads.bulkUpdate] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar leads em lote.' });
  }
}

module.exports = { list, getOne, update, remove, stats, bulkUpdate };
