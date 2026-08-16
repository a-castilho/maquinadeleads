const db = require('../config/db');

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

function normalizeMinLeadScore(value, fallback = 55) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
}

async function list(req, res) {
  try {
    const result = await db.query(
      `SELECT n.*,
              (SELECT COUNT(*)::int FROM leads l WHERE l.niche_id = n.id) AS leads_count,
              (SELECT COUNT(*)::int FROM leads l WHERE l.niche_id = n.id AND l.lead_score >= n.min_lead_score) AS qualified_leads_count,
              (SELECT COUNT(*)::int FROM native_jobs j WHERE j.niche_id = n.id AND j.status IN ('pending','processing','retry')) AS active_jobs
         FROM niches n
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC`,
      [req.user.sub]
    );
    res.json({ niches: result.rows });
  } catch (err) {
    console.error('[niches.list] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao listar campanhas.' });
  }
}

async function create(req, res) {
  const {
    name,
    description,
    location,
    offer,
    targetAudience,
    objective,
    minLeadScore,
    credentials: initialCreds,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Nome da campanha é obrigatório.' });

  const normalizedScore = normalizeMinLeadScore(minLeadScore, 55);
  if (normalizedScore === null) {
    return res.status(400).json({ error: 'Score mínimo deve ser um inteiro entre 0 e 100.' });
  }

  const slug = `${slugify(name)}-${Date.now().toString(36)}`;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const nicheResult = await client.query(
      `INSERT INTO niches
         (user_id, name, slug, description, location, offer, target_audience, objective, campaign_status, min_lead_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
       RETURNING *`,
      [
        req.user.sub,
        name,
        slug,
        description || null,
        location || null,
        offer || null,
        targetAudience || null,
        objective || null,
        normalizedScore,
      ]
    );
    const niche = nicheResult.rows[0];

    // O fluxo principal usa apenas provedores nativos. Postgres pertence à infraestrutura,
    // não é mais credencial da campanha, e n8n não é criado automaticamente.
    const defaultProviders = ['serper', 'evolution_api'];
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
          credData.extraConfig ? JSON.stringify(credData.extraConfig) : '{}',
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ niche });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[niches.create] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao criar campanha.', details: err.message });
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
    if (result.rows.length === 0) return res.status(404).json({ error: 'Campanha não encontrada.' });

    const campaign = result.rows[0];

    const [credsResult, jobsResult, leadsResult, keywordResult, templateResult, outboxResult] = await Promise.all([
      db.query(
        `SELECT id, niche_id, provider, base_url, extra_config, created_at,
                (api_key IS NOT NULL AND api_key <> '') AS has_api_key
           FROM credentials
          WHERE niche_id = $1
          ORDER BY provider`,
        [req.params.id]
      ),
      db.query(
        `SELECT id, job_type, status, attempts, max_attempts, last_error,
                created_at, updated_at, completed_at
           FROM native_jobs
          WHERE niche_id = $1
          ORDER BY created_at DESC
          LIMIT 30`,
        [req.params.id]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
                COUNT(*) FILTER (WHERE status = 'enviado')::int AS enviados,
                COUNT(*) FILTER (WHERE status = 'erro')::int AS erros,
                COUNT(*) FILTER (WHERE whatsapp IS NOT NULL)::int AS com_whatsapp,
                COUNT(*) FILTER (WHERE scored_at IS NOT NULL)::int AS scored,
                COUNT(*) FILTER (WHERE lead_score >= $2)::int AS qualified,
                COALESCE(ROUND(AVG(lead_score)) FILTER (WHERE lead_score IS NOT NULL), 0)::int AS average_score,
                COUNT(*) FILTER (WHERE funnel_stage = 'discovered')::int AS discovered,
                COUNT(*) FILTER (WHERE funnel_stage = 'qualified')::int AS funnel_qualified,
                COUNT(*) FILTER (WHERE funnel_stage = 'ready_for_contact')::int AS ready_for_contact,
                COUNT(*) FILTER (WHERE funnel_stage = 'contacted')::int AS contacted,
                COUNT(*) FILTER (WHERE funnel_stage = 'responded')::int AS responded,
                COUNT(*) FILTER (WHERE funnel_stage = 'interested')::int AS interested,
                COUNT(*) FILTER (WHERE funnel_stage = 'converted')::int AS converted,
                COUNT(*) FILTER (WHERE funnel_stage = 'discarded')::int AS discarded
           FROM leads
          WHERE niche_id = $1`,
        [req.params.id, Number(campaign.min_lead_score || 55)]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
           FROM keywords
          WHERE niche_id = $1 AND kind = 'nicho' AND active = true`,
        [req.params.id]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
           FROM message_templates
          WHERE niche_id = $1 AND active = true`,
        [req.params.id]
      ),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'unknown')::int AS unknown,
                COUNT(*) FILTER (WHERE status = 'sent')::int AS sent
           FROM native_message_outbox
          WHERE niche_id = $1`,
        [req.params.id]
      ),
    ]);

    const credentials = credsResult.rows;
    const leadStats = leadsResult.rows[0];
    const evolution = credentials.find((item) => item.provider === 'evolution_api');
    const profileComplete = Boolean(
      campaign.name && (campaign.description || campaign.offer) && campaign.objective
    );

    const readiness = {
      profileComplete,
      hasKeywords: keywordResult.rows[0].total > 0,
      hasMessage: templateResult.rows[0].total > 0,
      hasLeads: leadStats.total > 0,
      hasScoredLeads: leadStats.scored > 0,
      hasQualifiedLeads: leadStats.qualified > 0,
      hasEvolution: Boolean(evolution?.has_api_key && evolution?.base_url),
    };
    readiness.readyToActivate = Boolean(
      readiness.profileComplete &&
      readiness.hasKeywords &&
      readiness.hasMessage &&
      readiness.hasLeads &&
      readiness.hasEvolution
    );

    res.json({
      niche: campaign,
      credentials,
      jobs: jobsResult.rows,
      leadStats: {
        ...leadStats,
        outbox_unknown: outboxResult.rows[0]?.unknown || 0,
        outbox_sent: outboxResult.rows[0]?.sent || 0,
      },
      readiness,
    });
  } catch (err) {
    console.error('[niches.getOne] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao buscar campanha.' });
  }
}

async function update(req, res) {
  try {
    const {
      name,
      description,
      active,
      location,
      offer,
      targetAudience,
      objective,
      minLeadScore,
    } = req.body;

    let normalizedScore = null;
    if (minLeadScore !== undefined) {
      normalizedScore = normalizeMinLeadScore(minLeadScore, 55);
      if (normalizedScore === null) {
        return res.status(400).json({ error: 'Score mínimo deve ser um inteiro entre 0 e 100.' });
      }
    }

    const result = await db.query(
      `UPDATE niches SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         active = COALESCE($3, active),
         location = COALESCE($4, location),
         offer = COALESCE($5, offer),
         target_audience = COALESCE($6, target_audience),
         objective = COALESCE($7, objective),
         min_lead_score = COALESCE($8, min_lead_score)
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        name,
        description,
        active,
        location,
        offer,
        targetAudience,
        objective,
        normalizedScore,
        req.params.id,
        req.user.sub,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Campanha não encontrada.' });
    res.json({ niche: result.rows[0] });
  } catch (err) {
    console.error('[niches.update] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar campanha.' });
  }
}

async function remove(req, res) {
  try {
    const result = await db.query(
      'DELETE FROM niches WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Campanha não encontrada.' });
    res.status(204).send();
  } catch (err) {
    console.error('[niches.remove] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao remover campanha.' });
  }
}

module.exports = { list, create, getOne, update, remove };
