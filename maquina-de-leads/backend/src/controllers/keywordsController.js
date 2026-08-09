const db = require('../config/db');

async function assertNicheOwnership(nicheId, userId) {
  const r = await db.query('SELECT id FROM niches WHERE id = $1 AND user_id = $2', [nicheId, userId]);
  return r.rows.length > 0;
}

async function list(req, res) {
  const { nicheId } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  const result = await db.query(
    'SELECT * FROM keywords WHERE niche_id = $1 ORDER BY kind, term',
    [nicheId]
  );
  res.json({ keywords: result.rows });
}

async function bulkCreate(req, res) {
  const { nicheId } = req.params;
  const { terms, kind } = req.body; // terms: string[]
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  if (!Array.isArray(terms) || terms.length === 0) {
    return res.status(400).json({ error: 'Envie um array "terms" com pelo menos 1 palavra-chave.' });
  }

  const inserted = [];
  for (const term of terms) {
    const clean = String(term).trim();
    if (!clean) continue;
    const r = await db.query(
      `INSERT INTO keywords (niche_id, term, kind) VALUES ($1, $2, $3) RETURNING *`,
      [nicheId, clean, kind || 'nicho']
    );
    inserted.push(r.rows[0]);
  }
  res.status(201).json({ keywords: inserted });
}

async function update(req, res) {
  const { nicheId, id } = req.params;
  const { term, kind, active } = req.body;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  const result = await db.query(
    `UPDATE keywords SET
       term = COALESCE($1, term),
       kind = COALESCE($2, kind),
       active = COALESCE($3, active)
     WHERE id = $4 AND niche_id = $5
     RETURNING *`,
    [term, kind, active, id, nicheId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Palavra-chave não encontrada.' });
  res.json({ keyword: result.rows[0] });
}

async function remove(req, res) {
  const { nicheId, id } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  await db.query('DELETE FROM keywords WHERE id = $1 AND niche_id = $2', [id, nicheId]);
  res.status(204).send();
}

module.exports = { list, bulkCreate, update, remove, assertNicheOwnership };
