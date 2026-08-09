const db = require('../config/db');
const n8nService = require('../services/n8nService');

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function list(req, res) {
  try {
    const result = await db.query(
      'SELECT * FROM niches WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.sub]
    );
    res.json({ niches: result.rows });
  } catch (err) {
    console.error('[niches.list] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao listar nichos.' });
  }
}

async function create(req, res) {
  const { name, description, credentials: initialCreds } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome do nicho e obrigatorio.' });

  const slug = `${slugify(name)}-${Date.now().toString(36)}`;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const nicheResult = await client.query(
      `INSERT INTO niches (user_id, name, slug, description) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.sub, name, slug, description || null]
    );
    const niche = nicheResult.rows[0];

    // Cria credenciais default vazias para o nicho
    const defaultProviders = ['postgres_n8n', 'serper', 'evolution_api'];
    for (const provider of defaultProviders) {
      const credData = initialCreds?.[provider] || {};
      await client.query(
        `INSERT INTO credentials (niche_id, provider, api_key, base_url, extra_config)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (niche_id, provider) DO NOTHING`,
        [
          niche.id,
          provider,
          credData.apiKey || null,
          credData.baseUrl || null,
          credData.extraConfig ? JSON.stringify(credData.extraConfig) : '{}'
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ niche });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[niches.create] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao criar nicho.', details: err.message });
  } finally {
    client.release();
  }
}

async function getOne(req, res) {
  try {
    const result = await db.query(
      'SELECT * FROM niches WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.sub]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nicho nao encontrado.' });

    const [agentsResult, credsResult] = await Promise.all([
      db.query('SELECT * FROM n8n_agents WHERE niche_id = $1 ORDER BY created_at ASC', [req.params.id]),
      db.query('SELECT id, niche_id, provider, base_url, extra_config, created_at FROM credentials WHERE niche_id = $1', [req.params.id])
    ]);

    res.json({
      niche: result.rows[0],
      agents: agentsResult.rows,
      credentials: credsResult.rows
    });
  } catch (err) {
    console.error('[niches.getOne] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao buscar nicho.' });
  }
}

async function update(req, res) {
  try {
    const { name, description, active } = req.body;
    const result = await db.query(
      `UPDATE niches SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         active = COALESCE($3, active)
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [name, description, active, req.params.id, req.user.sub]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nicho nao encontrado.' });
    res.json({ niche: result.rows[0] });
  } catch (err) {
    console.error('[niches.update] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar nicho.' });
  }
}

async function remove(req, res) {
  try {
    await db.query('DELETE FROM niches WHERE id = $1 AND user_id = $2', [req.params.id, req.user.sub]);
    res.status(204).send();
  } catch (err) {
    console.error('[niches.remove] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao remover nicho.' });
  }
}

async function resyncAgent(req, res) {
  const { id: nicheId, agentId } = req.params;

  try {
    const nicheCheck = await db.query(
      'SELECT id FROM niches WHERE id = $1 AND user_id = $2',
      [nicheId, req.user.sub]
    );
    if (nicheCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Nicho nao encontrado.' });
    }

    const agentResult = await db.query(
      'SELECT * FROM n8n_agents WHERE id = $1 AND niche_id = $2',
      [agentId, nicheId]
    );
    if (agentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agente nao encontrado.' });
    }

    const agent = agentResult.rows[0];

    let n8nWorkflow;
    if (agent.n8n_workflow_id) {
      n8nWorkflow = await n8nService.updateWorkflow(agent.n8n_workflow_id, agent.config_snapshot);
    } else {
      n8nWorkflow = await n8nService.createWorkflow(agent.config_snapshot);
    }

    const updatedAgentResult = await db.query(
      `UPDATE n8n_agents SET
         n8n_workflow_id = $1,
         active = $2,
         last_sync_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [n8nWorkflow.id, n8nWorkflow.active, agent.id]
    );

    return res.json({
      message: 'Workflow gravado com sucesso no n8n!',
      agent: updatedAgentResult.rows[0]
    });
  } catch (error) {
    console.error('[resyncAgent] Erro:', error.message);
    return res.status(502).json({ error: `Erro ao ressincronizar com n8n: ${error.message}` });
  }
}

module.exports = { list, create, getOne, update, remove, resyncAgent };
