const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');

async function list(req, res) {
  const { nicheId } = req.params;
  const { status } = req.query;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
    const offset = (page - 1) * pageSize;

    const conditions = ['niche_id = $1'];
    const params = [nicheId];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const [result, countResult] = await Promise.all([
      db.query(
        `SELECT * FROM leads WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total FROM leads WHERE ${conditions.join(' AND ')}`,
        params
      )
    ]);

    res.json({
      leads: result.rows,
      total: countResult.rows[0].total,
      page,
      pageSize
    });
  } catch (err) {
    console.error('[leads.list] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao listar leads.' });
  }
}

async function stats(req, res) {
  const { nicheId } = req.params;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }
    const result = await db.query(
      `SELECT status, COUNT(*)::int AS total FROM leads WHERE niche_id = $1 GROUP BY status`,
      [nicheId]
    );
    res.json({ stats: result.rows });
  } catch (err) {
    console.error('[leads.stats] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao buscar estatisticas.' });
  }
}

module.exports = { list, stats };
