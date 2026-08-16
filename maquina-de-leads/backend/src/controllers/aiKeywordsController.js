const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');
const aiKeywordService = require('../services/aiKeywordService');

async function generate(req, res) {
  const { nicheId } = req.params;
  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    const result = await aiKeywordService.generateForCampaign({
      nicheId,
      userId: req.user.sub,
      instruction: String(req.body?.instruction || '').trim().slice(0, 2000),
    });
    return res.status(201).json(result);
  } catch (err) {
    console.error('[ai-keywords.generate] Erro:', err.message);
    return res.status(400).json({ error: err.message || 'Erro ao gerar palavras-chave.' });
  }
}

async function listRuns(req, res) {
  const { nicheId } = req.params;
  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    const result = await db.query(
      `SELECT id, provider, model, status, profile_completeness, principal_count, context_count,
              prompt_version, error_message, metadata, created_at
         FROM ai_keyword_runs
        WHERE niche_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT 20`,
      [nicheId, req.user.sub]
    );
    return res.json({ runs: result.rows });
  } catch (err) {
    console.error('[ai-keywords.listRuns] Erro:', err.message);
    return res.status(500).json({ error: 'Erro ao consultar histórico da IA.' });
  }
}

module.exports = { generate, listRuns };
