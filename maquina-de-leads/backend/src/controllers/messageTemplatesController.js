const db = require('../config/db');
const { assertNicheOwnership } = require('./keywordsController');

async function list(req, res) {
  const { nicheId } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  const result = await db.query(
    'SELECT * FROM message_templates WHERE niche_id = $1 ORDER BY created_at DESC',
    [nicheId]
  );
  res.json({ templates: result.rows });
}

async function create(req, res) {
  const { nicheId } = req.params;
  const { name, body } = req.body;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  if (!body) return res.status(400).json({ error: 'O texto da mensagem ("body") é obrigatório.' });

  const result = await db.query(
    `INSERT INTO message_templates (niche_id, name, body) VALUES ($1, $2, $3) RETURNING *`,
    [nicheId, name || 'Padrão', body]
  );
  res.status(201).json({ template: result.rows[0] });
}

async function update(req, res) {
  const { nicheId, id } = req.params;
  const { name, body, active } = req.body;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  const result = await db.query(
    `UPDATE message_templates SET
       name = COALESCE($1, name),
       body = COALESCE($2, body),
       active = COALESCE($3, active)
     WHERE id = $4 AND niche_id = $5
     RETURNING *`,
    [name, body, active, id, nicheId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template não encontrado.' });
  res.json({ template: result.rows[0] });
}

async function remove(req, res) {
  const { nicheId, id } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  await db.query('DELETE FROM message_templates WHERE id = $1 AND niche_id = $2', [id, nicheId]);
  res.status(204).send();
}

module.exports = { list, create, update, remove };
