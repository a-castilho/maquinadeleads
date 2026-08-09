const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');

async function list(req, res) {
  try {
    if (!(await assertNicheOwnership(req.params.nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }
    const result = await db.query(
      'SELECT * FROM message_templates WHERE niche_id = $1 ORDER BY created_at DESC',
      [req.params.nicheId]
    );
    res.json({ templates: result.rows });
  } catch (err) {
    console.error('[templates.list] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao listar templates.' });
  }
}

async function create(req, res) {
  try {
    if (!(await assertNicheOwnership(req.params.nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }
    const { name, body } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'O texto da mensagem ("body") e obrigatorio.' });
    }
    const result = await db.query(
      'INSERT INTO message_templates (niche_id, name, body) VALUES ($1, $2, $3) RETURNING *',
      [req.params.nicheId, name || 'Padrao', body.trim()]
    );
    res.status(201).json({ template: result.rows[0] });
  } catch (err) {
    console.error('[templates.create] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao criar template.' });
  }
}

async function update(req, res) {
  try {
    if (!(await assertNicheOwnership(req.params.nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }
    const { name, body, active } = req.body;
    const result = await db.query(
      'UPDATE message_templates SET name = COALESCE($1, name), body = COALESCE($2, body), active = COALESCE($3, active) WHERE id = $4 AND niche_id = $5 RETURNING *',
      [name, body, active, req.params.id, req.params.nicheId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template nao encontrado.' });
    res.json({ template: result.rows[0] });
  } catch (err) {
    console.error('[templates.update] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar template.' });
  }
}

async function remove(req, res) {
  try {
    if (!(await assertNicheOwnership(req.params.nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a este nicho.' });
    }
    await db.query('DELETE FROM message_templates WHERE id = $1 AND niche_id = $2', [req.params.id, req.params.nicheId]);
    res.status(204).send();
  } catch (err) {
    console.error('[templates.remove] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao remover template.' });
  }
}

module.exports = { list, create, update, remove };
