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

async function list(req, res) {
  try {
    const result = await db.query(
      `SELECT n.*,
              (SELECT COUNT(*)::int FROM leads l WHERE l.niche_id = n.id) AS leads_count,
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
    credentials: initialCreds,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Nome da campanha é obrigatório.' });

  const slug = `${slugify(name)}-${Date.now().toString(36)}`;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const nicheResult = await client.query(
      `INSERT INTO niches
         (user_id, name, slug, description, location, offer, target_audience, objective, campaign_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
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

    const [credsResult, jobsResult, leadsResult] = await Promise.all([
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
          LIMIT 20`,
        [req.params.id]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
                COUNT(*) FILTER (WHERE status = 'enviado')::int AS enviados,
                COUNT(*) FILTER (WHERE status = 'erro')::int AS erros,
                COUNT(*) FILTER (WHERE whatsapp IS NOT NULL)::int AS com_whatsapp
           FROM leads
          WHERE niche_id = $1`,
        [req.params.id]
      ),
    ]);

    res.json({
      niche: result.rows[0],
      credentials: credsResult.rows,
      jobs: jobsResult.rows,
      leadStats: leadsResult.rows[0],
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
      campaignStatus,
    } = req.body;

    const result = await db.query(
      `UPDATE niches SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         active = COALESCE($3, active),
         location = COALESCE($4, location),
         offer = COALESCE($5, offer),
         target_audience = COALESCE($6, target_audience),
         objective = COALESCE($7, objective),
         campaign_status = COALESCE($8, campaign_status)
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
        campaignStatus,
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
