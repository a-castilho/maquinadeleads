const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');

async function upsert(req, res) {
  const { nicheId } = req.params;
  const { provider, apiKey, baseUrl, extraConfig } = req.body;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a esta campanha.' });
    }
    if (!provider) return res.status(400).json({ error: 'Campo "provider" é obrigatório.' });

    const result = await db.query(
      `INSERT INTO credentials (niche_id, provider, api_key, base_url, extra_config)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (niche_id, provider)
       DO UPDATE SET
         api_key = CASE WHEN EXCLUDED.api_key IS NULL THEN credentials.api_key ELSE EXCLUDED.api_key END,
         base_url = CASE WHEN EXCLUDED.base_url IS NULL THEN credentials.base_url ELSE EXCLUDED.base_url END,
         extra_config = EXCLUDED.extra_config
       RETURNING id, niche_id, provider, base_url, extra_config, created_at,
                 (api_key IS NOT NULL AND api_key <> '') AS has_api_key`,
      [
        nicheId,
        provider,
        apiKey ? apiKey : null,
        baseUrl === undefined ? null : (baseUrl || null),
        JSON.stringify(extraConfig || {}),
      ]
    );

    res.status(200).json({ credential: result.rows[0] });
  } catch (err) {
    console.error('[credentials.upsert] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao salvar credencial.' });
  }
}

async function list(req, res) {
  const { nicheId } = req.params;

  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(403).json({ error: 'Acesso negado a esta campanha.' });
    }
    const result = await db.query(
      `SELECT id, niche_id, provider, base_url, extra_config, created_at,
              (api_key IS NOT NULL AND api_key <> '') AS has_api_key
         FROM credentials
        WHERE niche_id = $1
        ORDER BY provider`,
      [nicheId]
    );
    res.json({ credentials: result.rows });
  } catch (err) {
    console.error('[credentials.list] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao listar credenciais.' });
  }
}

module.exports = { upsert, list };
