const db = require('../config/db');
const { assertNicheOwnership } = require('./keywordsController');

// provider: 'serper' | 'evolution_api' | 'postgres_n8n'
async function upsert(req, res) {
  const { nicheId } = req.params;
  const { provider, apiKey, baseUrl, extraConfig } = req.body;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  if (!provider) return res.status(400).json({ error: 'Campo "provider" é obrigatório.' });

  const result = await db.query(
    `INSERT INTO credentials (niche_id, provider, api_key, base_url, extra_config)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (niche_id, provider)
     DO UPDATE SET api_key = EXCLUDED.api_key, base_url = EXCLUDED.base_url, extra_config = EXCLUDED.extra_config
     RETURNING id, niche_id, provider, base_url, extra_config, created_at`,
    [nicheId, provider, apiKey || null, baseUrl || null, extraConfig || {}]
  );
  // Nunca devolvemos api_key na resposta por segurança
  res.status(200).json({ credential: result.rows[0] });
}

async function list(req, res) {
  const { nicheId } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Nicho não encontrado.' });
  }
  const result = await db.query(
    'SELECT id, niche_id, provider, base_url, extra_config, created_at FROM credentials WHERE niche_id = $1',
    [nicheId]
  );
  res.json({ credentials: result.rows });
}

module.exports = { upsert, list };
