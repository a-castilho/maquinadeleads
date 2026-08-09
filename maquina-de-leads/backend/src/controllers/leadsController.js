const db = require('../config/db');
const { assertNicheOwnership } = require('./keywordsController');

async function list(req, res) {
  const { nicheId } = req.params;
  const { status, page = 1, pageSize = 25 } = req.query;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }

  const conditions = ['niche_id = $1'];
  const params = [nicheId];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const offset = (Number(page) - 1) * Number(pageSize);
  params.push(Number(pageSize), offset);

  const result = await db.query(
    `SELECT * FROM leads WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM leads WHERE ${conditions.join(' AND ')}`,
    params.slice(0, conditions.length)
  );

  res.json({ leads: result.rows, total: countResult.rows[0].total, page: Number(page), pageSize: Number(pageSize) });
}

async function stats(req, res) {
  const { nicheId } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  const result = await db.query(
    `SELECT status, COUNT(*)::int AS total FROM leads WHERE niche_id = $1 GROUP BY status`,
    [nicheId]
  );
  res.json({ stats: result.rows });
}

module.exports = { list, stats };
