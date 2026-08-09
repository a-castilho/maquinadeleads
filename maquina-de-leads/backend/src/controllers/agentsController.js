const db = require('../config/db');
const { assertNicheOwnership } = require('./keywordsController');
const n8nService = require('../services/n8nService');
const { buildScrapingWorkflow } = require('../templates/scrapingTemplate');
const { buildSendingWorkflow } = require('../templates/sendingTemplate');

async function loadNicheConfig(nicheId) {
  const niche = (await db.query('SELECT * FROM niches WHERE id = $1', [nicheId])).rows[0];
  const keywords = (await db.query(
    "SELECT term FROM keywords WHERE niche_id = $1 AND kind = 'nicho' AND active = true", [nicheId]
  )).rows.map((r) => r.term);
  const contextTerms = (await db.query(
    "SELECT term FROM keywords WHERE niche_id = $1 AND kind = 'contexto' AND active = true", [nicheId]
  )).rows.map((r) => r.term);
  const template = (await db.query(
    'SELECT body FROM message_templates WHERE niche_id = $1 AND active = true ORDER BY created_at DESC LIMIT 1',
    [nicheId]
  )).rows[0];
  const creds = (await db.query('SELECT * FROM credentials WHERE niche_id = $1', [nicheId])).rows;

  const credByProvider = Object.fromEntries(creds.map((c) => [c.provider, c]));

  return { niche, keywords, contextTerms, template, credByProvider };
}

/**
 * Resolve o ID da credencial Postgres no n8n.
 * A API publica do n8n nao expoe endpoint para LISTAR credenciais
 * (retorna 401/nao suportado por design de seguranca), entao o unico
 * caminho valido e o cadastro manual do ID no dashboard, salvo em
 * credentials.extra_config.n8nCredentialId.
 */
function resolvePostgresCredentialId(pgCred) {
  return pgCred?.extra_config?.n8nCredentialId || null;
}

async function createOrUpdateAgent(req, res) {
  const { nicheId } = req.params;
  const { agentType } = req.body; // 'raspagem' | 'envio'

  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  if (!['raspagem', 'envio'].includes(agentType)) {
    return res.status(400).json({ error: 'agentType deve ser "raspagem" ou "envio".' });
  }

  try {
    const { niche, keywords, contextTerms, template, credByProvider } = await loadNicheConfig(nicheId);

    if (agentType === 'raspagem' && keywords.length === 0) {
      return res.status(400).json({ error: 'Cadastre ao menos uma palavra-chave antes de criar o agente de raspagem.' });
    }
    if (agentType === 'envio' && !template) {
      return res.status(400).json({ error: 'Cadastre um template de mensagem antes de criar o agente de envio.' });
    }

    const pg = credByProvider['postgres_n8n'];
    const postgresCredentialId = resolvePostgresCredentialId(pg);

    if (!postgresCredentialId) {
      return res.status(400).json({
        error: 'Credencial Postgres do n8n não encontrada.',
        details: 'Cadastre uma credencial "postgres_n8n" com extra_config.n8nCredentialId preenchido (copie o ID direto da URL da credencial no n8n).',
      });
    }

    let workflowJson;
    if (agentType === 'raspagem') {
      const serper = credByProvider['serper'];
      if (!serper?.api_key) return res.status(400).json({ error: 'Credencial "serper" não configurada para este nicho.' });

      workflowJson = buildScrapingWorkflow({
        nicheId,
        nicheName: niche.name,
        keywords,
        contextTerms: contextTerms.length ? contextTerms : undefined,
        serperApiKey: serper.api_key,
        postgresCredentialId,
      });
    } else {
      const evo = credByProvider['evolution_api'];
      if (!evo?.api_key || !evo?.base_url) {
        return res.status(400).json({ error: 'Credencial "evolution_api" (base_url + api_key) não configurada para este nicho.' });
      }
      workflowJson = buildSendingWorkflow({
        nicheId,
        nicheName: niche.name,
        messageTemplate: template.body,
        evolutionBaseUrl: evo.base_url,
        evolutionInstance: evo.extra_config?.instanceName || niche.slug,
        evolutionApiKey: evo.api_key,
        postgresCredentialId,
      });
    }

    const existing = (await db.query(
      'SELECT * FROM n8n_agents WHERE niche_id = $1 AND agent_type = $2', [nicheId, agentType]
    )).rows[0];

    let n8nResponse;
    if (existing?.n8n_workflow_id) {
      n8nResponse = await n8nService.updateWorkflow(existing.n8n_workflow_id, workflowJson);
    } else {
      n8nResponse = await n8nService.createWorkflow(workflowJson);
    }

    const saved = await db.query(
      `INSERT INTO n8n_agents (niche_id, agent_type, n8n_workflow_id, active, config_snapshot, last_sync_at)
       VALUES ($1, $2, $3, false, $4, NOW())
       ON CONFLICT (niche_id, agent_type)
       DO UPDATE SET n8n_workflow_id = EXCLUDED.n8n_workflow_id, config_snapshot = EXCLUDED.config_snapshot, last_sync_at = NOW()
       RETURNING *`,
      [nicheId, agentType, n8nResponse.id, JSON.stringify(workflowJson)]
    );

    res.status(201).json({ agent: saved.rows[0] });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(502).json({ error: 'Falha ao criar/atualizar o workflow no n8n.', details: err.response?.data || err.message });
  }
}

/**
 * Recria/Atualiza o workflow no n8n com as configurações mais recentes
 * do banco e atualiza a tabela n8n_agents.
 *
 * Lógica resiliente:
 *   - Se o workflow foi deletado no n8n (404) → cria um novo
 *   - Se o workflow está arquivado → deleta o antigo e cria um novo
 *   - Se existe normalmente → apenas atualiza
 */
async function resync(req, res) {
  const { nicheId, id } = req.params;

  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }

  const agent = (await db.query(
    'SELECT * FROM n8n_agents WHERE id = $1 AND niche_id = $2',
    [id, nicheId]
  )).rows[0];

  if (!agent) {
    return res.status(404).json({ error: 'Agente não encontrado.' });
  }

  try {
    const { niche, keywords, contextTerms, template, credByProvider } = await loadNicheConfig(nicheId);

    const pg = credByProvider['postgres_n8n'];
    const postgresCredentialId = resolvePostgresCredentialId(pg);

    if (!postgresCredentialId) {
      return res.status(400).json({
        error: 'Credencial Postgres do n8n não encontrada.',
        details: 'Cadastre uma credencial "postgres_n8n" com extra_config.n8nCredentialId preenchido (copie o ID direto da URL da credencial no n8n).',
      });
    }

    let workflowJson;
    if (agent.agent_type === 'raspagem') {
      const serper = credByProvider['serper'];
      if (!serper?.api_key) return res.status(400).json({ error: 'Credencial "serper" não configurada para este nicho.' });

      workflowJson = buildScrapingWorkflow({
        nicheId,
        nicheName: niche.name,
        keywords,
        contextTerms: contextTerms.length ? contextTerms : undefined,
        serperApiKey: serper.api_key,
        postgresCredentialId,
      });
    } else {
      const evo = credByProvider['evolution_api'];
      if (!evo?.api_key || !evo?.base_url) {
        return res.status(400).json({ error: 'Credencial "evolution_api" (base_url + api_key) não configurada para este nicho.' });
      }

      workflowJson = buildSendingWorkflow({
        nicheId,
        nicheName: niche.name,
        messageTemplate: template.body,
        evolutionBaseUrl: evo.base_url,
        evolutionInstance: evo.extra_config?.instanceName || niche.slug,
        evolutionApiKey: evo.api_key,
        postgresCredentialId,
      });
    }

    let n8nResponse;
    let workflowId = agent.n8n_workflow_id;
    let needsNew = false;

    if (workflowId) {
      try {
        const existing = await n8nService.getWorkflow(workflowId);

        if (existing.isArchived) {
          // Workflow arquivado: n8n não permite update nem unarchive via API
          // Deletamos o antigo e criamos um novo
          try {
            await n8nService.deleteWorkflow(workflowId);
          } catch (delErr) {
            // Ignora erro ao deletar (pode já ter sido deletado)
            console.warn('Aviso ao deletar workflow arquivado:', delErr.message);
          }
          needsNew = true;
        } else {
          n8nResponse = await n8nService.updateWorkflow(workflowId, workflowJson);
        }
      } catch (err) {
        if (err.response?.status === 404) {
          // Workflow foi deletado no n8n → cria novo
          needsNew = true;
        } else {
          throw err;
        }
      }
    } else {
      needsNew = true;
    }

    if (needsNew) {
      n8nResponse = await n8nService.createWorkflow(workflowJson);
      workflowId = n8nResponse.id;
    }

    const updated = await db.query(
      `UPDATE n8n_agents
       SET n8n_workflow_id = $1,
           config_snapshot = $2,
           last_sync_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [workflowId, JSON.stringify(workflowJson), id]
    );

    res.json({ agent: updated.rows[0] });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(502).json({
      error: 'Falha ao ressincronizar o workflow no n8n.',
      details: err.response?.data || err.message,
    });
  }
}

async function toggleActive(req, res) {
  const { nicheId, id } = req.params;
  const { active } = req.body;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  const agent = (await db.query('SELECT * FROM n8n_agents WHERE id = $1 AND niche_id = $2', [id, nicheId])).rows[0];
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado.' });

  try {
    await n8nService.setActive(agent.n8n_workflow_id, !!active);
    const updated = await db.query(
      'UPDATE n8n_agents SET active = $1 WHERE id = $2 RETURNING *',
      [!!active, id]
    );
    res.json({ agent: updated.rows[0] });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(502).json({ error: 'Falha ao ativar/desativar o workflow no n8n.' });
  }
}

async function list(req, res) {
  const { nicheId } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  const result = await db.query('SELECT * FROM n8n_agents WHERE niche_id = $1', [nicheId]);
  res.json({ agents: result.rows });
}

async function remove(req, res) {
  const { nicheId, id } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  const agent = (await db.query('SELECT * FROM n8n_agents WHERE id = $1 AND niche_id = $2', [id, nicheId])).rows[0];
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado.' });

  try {
    if (agent.n8n_workflow_id) await n8nService.deleteWorkflow(agent.n8n_workflow_id);
  } catch (err) {
    console.warn('Aviso: não foi possível remover o workflow no n8n:', err.message);
  }
  await db.query('DELETE FROM n8n_agents WHERE id = $1', [id]);
  res.status(204).send();
}

module.exports = { createOrUpdateAgent, resync, toggleActive, list, remove };
