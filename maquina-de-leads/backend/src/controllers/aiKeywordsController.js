const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');
const aiKeywordService = require('../services/aiKeywordService');
const aiKeywordChatService = require('../services/aiKeywordChatService');

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

async function chat(req, res) {
  const { nicheId } = req.params;
  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    const result = await aiKeywordChatService.chat({
      nicheId,
      userId: req.user.sub,
      message: req.body?.message,
    });
    return res.status(201).json({ message: result });
  } catch (err) {
    console.error(`[ai-keywords.chat] niche=${nicheId}:`, err.message);
    return res.status(400).json({ error: err.message || 'Erro na conversa com especialista.' });
  }
}

async function chatHistory(req, res) {
  const { nicheId } = req.params;
  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    return res.json({ messages: await aiKeywordChatService.history(nicheId, req.user.sub) });
  } catch (err) {
    console.error(`[ai-keywords.chatHistory] niche=${nicheId}:`, err.message);
    return res.status(500).json({ error: 'Erro ao carregar conversa com especialista.' });
  }
}

async function clearChat(req, res) {
  const { nicheId } = req.params;
  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    const deleted = await aiKeywordChatService.clear(nicheId, req.user.sub);
    return res.json({ deleted });
  } catch (err) {
    console.error(`[ai-keywords.clearChat] niche=${nicheId}:`, err.message);
    return res.status(500).json({ error: 'Erro ao limpar conversa.' });
  }
}

module.exports = { generate, listRuns, chat, chatHistory, clearChat };
