const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');

async function list(req, res) {
  const { nicheId } = req.params;
  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }
    const result = await db.query(
      'SELECT * FROM keywords WHERE niche_id = $1 ORDER BY kind, term',
      [nicheId]
    );
    res.json({ keywords: result.rows });
  } catch (err) {
    console.error('[keywords.list] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao listar palavras-chave.' });
  }
}

async function bulkCreate(req, res) {
  const { nicheId } = req.params;
  const { terms, kind } = req.body;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }
    if (!Array.isArray(terms) || terms.length === 0) {
      return res.status(400).json({ error: 'Envie um array "terms" com pelo menos 1 palavra-chave.' });
    }

    const inserted = [];
    for (const term of terms) {
      const clean = String(term).trim().slice(0, 100);
      if (!clean) continue;
      const r = await db.query(
        `INSERT INTO keywords (niche_id, term, kind) VALUES ($1, $2, $3) RETURNING *`,
        [nicheId, clean, kind || 'nicho']
      );
      inserted.push(r.rows[0]);
    }
    res.status(201).json({ keywords: inserted });
  } catch (err) {
    console.error('[keywords.bulkCreate] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao criar palavras-chave.' });
  }
}

async function update(req, res) {
  const { nicheId, id } = req.params;
  const { term, kind, active } = req.body;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
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
    if (result.rows.length === 0) return res.status(404).json({ error: 'Palavra-chave nao encontrada.' });
    res.json({ keyword: result.rows[0] });
  } catch (err) {
    console.error('[keywords.update] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar palavra-chave.' });
  }
}

async function remove(req, res) {
  const { nicheId, id } = req.params;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }
    await db.query('DELETE FROM keywords WHERE id = $1 AND niche_id = $2', [id, nicheId]);
    res.status(204).send();
  } catch (err) {
    console.error('[keywords.remove] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao remover palavra-chave.' });
  }
}

module.exports = { list, bulkCreate, update, remove };
