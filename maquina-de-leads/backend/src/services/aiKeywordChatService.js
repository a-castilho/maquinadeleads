const axios = require('axios');
const db = require('../config/db');
const { buildProfileContext, fallbackKeywords } = require('./aiKeywordService');

function uniq(values, limit = 40) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))].slice(0, limit);
}

function buildSpecialistPrompt({ profile, campaign, history = [], message, config = {} }) {
  const context = buildProfileContext(profile, campaign);
  const recent = history.slice(-12).map((item) => ({ role: item.role, content: item.content }));
  const country = String(config.country || 'Brasil').trim();
  const language = String(config.language || 'pt-BR').trim();
  const specialistInstruction = String(config.specialistInstruction || '').trim();

  return [
    'Você é um especialista sênior em pesquisa de mercado, prospecção B2B, SEO local e descoberta de empresas.',
    `Mercado prioritário: ${country}. Idioma: ${language}.`,
    'Seu papel é conversar com o usuário para melhorar a estratégia de busca de leads empresariais.',
    'Analise sempre o Perfil da Empresa, ICP e campanha antes de responder.',
    'Quando sugerir termos, diferencie: principal = quem/qual empresa procurar; contexto = sinais de localização, contato, operação, cargo, dor ou intenção.',
    'Evite termos focados em consumidor final quando a campanha for B2B. Evite duplicatas e termos excessivamente genéricos.',
    'Explique brevemente por que a estratégia proposta tende a melhorar a descoberta.',
    specialistInstruction ? `Instrução permanente do especialista: ${specialistInstruction}` : '',
    `Perfil e campanha: ${JSON.stringify(context)}`,
    `Histórico recente: ${JSON.stringify(recent)}`,
    `Mensagem atual do usuário: ${message}`,
  ].filter(Boolean).join('\n');
}

function fallbackReply({ profile, campaign, message }) {
  const plan = fallbackKeywords(profile, campaign);
  const lower = String(message || '').toLowerCase();
  const focus = lower.includes('local') || lower.includes('cidade')
    ? 'Vou priorizar localização e sinais de presença regional.'
    : lower.includes('whatsapp') || lower.includes('telefone')
      ? 'Vou priorizar termos de contato e presença digital.'
      : 'Vou priorizar aderência ao ICP e sinais de operação empresarial.';

  return {
    answer: `${focus} A IA externa não está configurada ou não respondeu, então gerei uma estratégia local usando o Perfil da Empresa e a campanha. Revise as sugestões antes de aplicar.`,
    principal: uniq(plan.principal, 24),
    contexto: uniq(plan.contexto, 24),
    negativas: uniq(profile?.negative_keywords || [], 20),
    fallback: true,
  };
}

function extractText(response) {
  if (typeof response?.data?.output_text === 'string') return response.data.output_text;
  const parts = [];
  for (const item of response?.data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n');
}

function parseChatPayload(text) {
  const parsed = JSON.parse(text);
  return {
    answer: String(parsed.answer || '').trim(),
    principal: uniq(parsed.principal, 30),
    contexto: uniq(parsed.contexto, 30),
    negativas: uniq(parsed.negativas, 20),
    fallback: false,
  };
}

async function requestOpenAI({ apiKey, model, prompt }) {
  const response = await axios.post('https://api.openai.com/v1/responses', {
    model,
    input: prompt,
    text: {
      format: {
        type: 'json_schema',
        name: 'keyword_specialist_reply',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            answer: { type: 'string' },
            principal: { type: 'array', items: { type: 'string' } },
            contexto: { type: 'array', items: { type: 'string' } },
            negativas: { type: 'array', items: { type: 'string' } },
          },
          required: ['answer', 'principal', 'contexto', 'negativas'],
        },
      },
    },
  }, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: Math.max(10000, Number(process.env.AI_KEYWORD_CHAT_TIMEOUT_MS) || 30000),
  });
  return parseChatPayload(extractText(response));
}

async function loadContext(nicheId, userId) {
  const [campaignResult, profileResult, credentialResult, historyResult] = await Promise.all([
    db.query('SELECT * FROM niches WHERE id = $1 AND user_id = $2', [nicheId, userId]),
    db.query('SELECT * FROM company_profiles WHERE user_id = $1', [userId]),
    db.query(`SELECT api_key, extra_config FROM credentials WHERE niche_id = $1 AND provider = 'openai' LIMIT 1`, [nicheId]),
    db.query(`SELECT id, role, content, principal, contexto, negativas, provider, model, created_at
                FROM ai_keyword_chat_messages
               WHERE niche_id = $1 AND user_id = $2
               ORDER BY created_at ASC
               LIMIT 100`, [nicheId, userId]),
  ]);
  const campaign = campaignResult.rows[0];
  if (!campaign) throw new Error('Campanha não encontrada.');
  const profile = profileResult.rows[0];
  if (!profile) throw new Error('Cadastre o Perfil da Empresa antes de conversar com a IA especialista.');
  return { campaign, profile, credential: credentialResult.rows[0], history: historyResult.rows };
}

async function saveMessage({ nicheId, userId, role, content, reply = {}, provider = 'user', model = null, metadata = {} }) {
  const result = await db.query(
    `INSERT INTO ai_keyword_chat_messages
      (niche_id,user_id,role,content,principal,contexto,negativas,provider,model,metadata)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb)
     RETURNING id, role, content, principal, contexto, negativas, provider, model, created_at`,
    [nicheId, userId, role, content, JSON.stringify(reply.principal || []), JSON.stringify(reply.contexto || []),
      JSON.stringify(reply.negativas || []), provider, model, JSON.stringify(metadata || {})]
  );
  return result.rows[0];
}

async function chat({ nicheId, userId, message }) {
  const cleanMessage = String(message || '').trim().slice(0, 4000);
  if (!cleanMessage) throw new Error('Digite uma mensagem para o especialista.');

  const context = await loadContext(nicheId, userId);
  const config = context.credential?.extra_config || {};
  const model = config.model || 'gpt-5-mini';
  await saveMessage({ nicheId, userId, role: 'user', content: cleanMessage });

  const prompt = buildSpecialistPrompt({
    profile: context.profile,
    campaign: context.campaign,
    history: context.history,
    message: cleanMessage,
    config,
  });

  let reply;
  let provider = 'fallback';
  let errorMessage = null;
  if (context.credential?.api_key) {
    try {
      reply = await requestOpenAI({ apiKey: context.credential.api_key, model, prompt });
      provider = 'openai';
    } catch (error) {
      errorMessage = error.response?.data?.error?.message || error.message;
      console.error(`[ai-keyword-chat] openai failed niche=${nicheId} model=${model}: ${errorMessage}`);
    }
  }
  if (!reply) reply = fallbackReply({ profile: context.profile, campaign: context.campaign, message: cleanMessage });

  const saved = await saveMessage({
    nicheId,
    userId,
    role: 'assistant',
    content: reply.answer,
    reply,
    provider,
    model,
    metadata: { fallback: provider !== 'openai', error: errorMessage },
  });

  console.log(`[ai-keyword-chat] niche=${nicheId} provider=${provider} principal=${reply.principal.length} contexto=${reply.contexto.length} negativas=${reply.negativas.length}`);
  return { ...saved, fallback: provider !== 'openai', warning: errorMessage };
}

async function history(nicheId, userId) {
  const result = await db.query(
    `SELECT id, role, content, principal, contexto, negativas, provider, model, created_at
       FROM ai_keyword_chat_messages
      WHERE niche_id = $1 AND user_id = $2
      ORDER BY created_at ASC
      LIMIT 100`,
    [nicheId, userId]
  );
  return result.rows;
}

async function clear(nicheId, userId) {
  const result = await db.query(
    'DELETE FROM ai_keyword_chat_messages WHERE niche_id = $1 AND user_id = $2',
    [nicheId, userId]
  );
  console.log(`[ai-keyword-chat] cleared niche=${nicheId} count=${result.rowCount}`);
  return result.rowCount;
}

module.exports = { buildSpecialistPrompt, fallbackReply, parseChatPayload, chat, history, clear };
