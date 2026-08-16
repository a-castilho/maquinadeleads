const axios = require('axios');
const db = require('../config/db');
const { generateKeywords } = require('./companyProfileService');

const PROMPT_VERSION = 'company-profile-v1';

function uniq(values, limit = 40) {
  return [...new Set((values || []).map((v) => String(v || '').trim()).filter((v) => v.length >= 2))].slice(0, limit);
}

function buildProfileContext(profile = {}, campaign = {}) {
  return {
    empresa: profile.trade_name || profile.legal_name || '',
    segmento: profile.market_segment || '',
    subsegmentos: profile.subsegments || [],
    descricao: profile.description || '',
    produtos_servicos: profile.products_services || [],
    proposta_valor: profile.value_proposition || '',
    diferenciais: profile.differentiators || [],
    regioes: profile.service_regions || [],
    icp: profile.ideal_customer_profile || {},
    setores_alvo: profile.target_industries || [],
    portes_alvo: profile.target_company_sizes || [],
    decisores: profile.target_roles || [],
    personas: profile.buyer_personas || [],
    dores: profile.customer_pains || [],
    gatilhos: profile.purchase_triggers || [],
    desqualificadores: profile.disqualifiers || [],
    sementes: profile.keywords_seed || [],
    negativas: profile.negative_keywords || [],
    observacoes: profile.search_notes || '',
    campanha: {
      nome: campaign.name || '',
      descricao: campaign.description || '',
      localizacao: campaign.location || '',
      oferta: campaign.offer || '',
      publico: campaign.target_audience || '',
      objetivo: campaign.objective || '',
    },
  };
}

function buildPrompt(profile, campaign, instruction = '') {
  const context = buildProfileContext(profile, campaign);
  return [
    'Você é um especialista em prospecção B2B e pesquisa de empresas no Brasil.',
    'Sua tarefa é criar termos de descoberta para encontrar EMPRESAS que correspondam ao ICP, e não consumidores finais.',
    'Gere termos curtos, pesquisáveis e úteis em mecanismos de busca. Evite frases comerciais genéricas.',
    'Separe em: principal = segmentos, tipos de empresa, serviços, sinais de operação e intenção; contexto = localização, contato, WhatsApp, telefone, CNPJ, cargos, dores e gatilhos.',
    'Não inclua palavras negativas. Não invente dados específicos da empresa-alvo.',
    instruction ? `Instrução adicional do usuário: ${instruction}` : '',
    `Perfil e campanha: ${JSON.stringify(context)}`,
  ].filter(Boolean).join('\n');
}

function fallbackKeywords(profile, campaign) {
  const generated = generateKeywords(profile || {});
  const principals = uniq([
    ...(profile?.keywords_seed || []),
    profile?.market_segment,
    ...(profile?.subsegments || []),
    ...(profile?.target_industries || []),
    ...(profile?.products_services || []),
    campaign?.description,
    campaign?.offer,
    ...generated,
  ], 35);
  const context = uniq([
    ...(profile?.service_regions || []),
    campaign?.location,
    ...(profile?.target_roles || []),
    ...(profile?.customer_pains || []),
    ...(profile?.purchase_triggers || []),
    'whatsapp', 'telefone', 'contato', 'cnpj', 'site oficial',
  ], 30);
  return { principal: principals, contexto: context };
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

function parseKeywordPayload(text) {
  const parsed = JSON.parse(text);
  return {
    principal: uniq(parsed.principal, 40),
    contexto: uniq(parsed.contexto, 40),
  };
}

async function requestOpenAI({ apiKey, model, prompt }) {
  const response = await axios.post('https://api.openai.com/v1/responses', {
    model,
    input: prompt,
    text: {
      format: {
        type: 'json_schema',
        name: 'keyword_plan',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            principal: { type: 'array', items: { type: 'string' } },
            contexto: { type: 'array', items: { type: 'string' } },
          },
          required: ['principal', 'contexto'],
        },
      },
    },
  }, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 30000,
  });
  return parseKeywordPayload(extractText(response));
}

async function saveKeywords(nicheId, plan) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    for (const [kind, values] of [['nicho', plan.principal], ['contexto', plan.contexto]]) {
      for (const term of uniq(values, 40)) {
        const result = await client.query(
          `INSERT INTO keywords (niche_id, term, kind)
           SELECT $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM keywords WHERE niche_id = $1 AND LOWER(term) = LOWER($2) AND kind = $3
           ) RETURNING id`,
          [nicheId, term.slice(0, 150), kind]
        );
        inserted += result.rowCount;
      }
    }
    await client.query('COMMIT');
    return inserted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function logRun({ nicheId, userId, provider, model, status, profileCompleteness, plan, error, metadata = {} }) {
  await db.query(
    `INSERT INTO ai_keyword_runs
      (niche_id,user_id,provider,model,status,profile_completeness,principal_count,context_count,prompt_version,error_message,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [nicheId, userId, provider, model || null, status, profileCompleteness || 0,
      plan?.principal?.length || 0, plan?.contexto?.length || 0, PROMPT_VERSION,
      error ? String(error).slice(0, 1000) : null, JSON.stringify(metadata)]
  );
}

async function generateForCampaign({ nicheId, userId, instruction = '' }) {
  const [campaignResult, profileResult, credentialResult] = await Promise.all([
    db.query('SELECT * FROM niches WHERE id = $1 AND user_id = $2', [nicheId, userId]),
    db.query('SELECT * FROM company_profiles WHERE user_id = $1', [userId]),
    db.query(`SELECT api_key, extra_config FROM credentials WHERE niche_id = $1 AND provider = 'openai' LIMIT 1`, [nicheId]),
  ]);
  const campaign = campaignResult.rows[0];
  if (!campaign) throw new Error('Campanha não encontrada.');
  const profile = profileResult.rows[0];
  if (!profile) throw new Error('Cadastre o Perfil da Empresa antes de gerar termos com IA.');

  const credential = credentialResult.rows[0];
  const model = credential?.extra_config?.model || 'gpt-5-mini';
  const prompt = buildPrompt(profile, campaign, instruction || credential?.extra_config?.promptInstruction || '');
  let plan;
  let provider = 'fallback';
  let status = 'fallback';
  let aiError = null;

  if (credential?.api_key) {
    try {
      plan = await requestOpenAI({ apiKey: credential.api_key, model, prompt });
      provider = 'openai';
      status = 'completed';
    } catch (err) {
      aiError = err.response?.data?.error?.message || err.message;
      console.error('[ai-keywords] OpenAI indisponível, usando fallback:', aiError);
    }
  }

  if (!plan || !plan.principal.length) plan = fallbackKeywords(profile, campaign);
  const inserted = await saveKeywords(nicheId, plan);
  await logRun({
    nicheId, userId, provider, model, status, profileCompleteness: profile.profile_completeness,
    plan, error: aiError, metadata: { inserted, hadApiKey: Boolean(credential?.api_key) },
  });
  console.log(`[ai-keywords] niche=${nicheId} provider=${provider} principal=${plan.principal.length} contexto=${plan.contexto.length} inserted=${inserted}`);
  return { ...plan, provider, model, inserted, fallback: provider === 'fallback', warning: aiError };
}

module.exports = {
  buildProfileContext,
  buildPrompt,
  fallbackKeywords,
  parseKeywordPayload,
  generateForCampaign,
};
