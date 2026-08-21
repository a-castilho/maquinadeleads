const axios = require('axios');

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-mini';

function normalizeText(value, maxLength = 240) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function clampQuantity(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(20, Math.max(1, parsed));
}

function leadSchema(quantity) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      leads: {
        type: 'array',
        minItems: 0,
        maxItems: quantity,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            company_name: { type: 'string' },
            website: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            city: { type: ['string', 'null'] },
            state: { type: ['string', 'null'] },
            segment: { type: ['string', 'null'] },
            reason: { type: 'string' },
            source_url: { type: ['string', 'null'] },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
          },
          required: [
            'company_name',
            'website',
            'phone',
            'city',
            'state',
            'segment',
            'reason',
            'source_url',
            'confidence',
          ],
        },
      },
    },
    required: ['summary', 'leads'],
  };
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        return content.text.trim();
      }
    }
  }

  return '';
}

function extractSources(response) {
  const seen = new Set();
  const sources = [];

  for (const item of response?.output || []) {
    if (item?.type !== 'web_search_call') continue;
    const candidates = [
      ...(item.action?.sources || []),
      ...(item.results || []),
    ];

    for (const source of candidates) {
      const url = source?.url || source?.source_url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      sources.push({
        title: source?.title || source?.name || url,
        url,
      });
    }
  }

  return sources.slice(0, 40);
}

async function discoverLeadsWithGpt({ segment, location, offer, objective, quantity }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY não configurada no backend.');
    error.code = 'OPENAI_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }

  const safeSegment = normalizeText(segment, 180);
  const safeLocation = normalizeText(location, 180);
  const safeOffer = normalizeText(offer, 300);
  const safeObjective = normalizeText(objective, 300);
  const safeQuantity = clampQuantity(quantity);

  if (!safeSegment || !safeLocation) {
    const error = new Error('Informe segmento e localização para buscar potenciais clientes.');
    error.code = 'INVALID_SEARCH';
    error.status = 400;
    throw error;
  }

  const model = process.env.OPENAI_LEAD_SEARCH_MODEL?.trim() || DEFAULT_MODEL;
  const prompt = [
    `Encontre até ${safeQuantity} empresas reais que possam ser potenciais clientes.`,
    `Segmento desejado: ${safeSegment}.`,
    `Localização: ${safeLocation}.`,
    safeOffer ? `Produto/serviço oferecido: ${safeOffer}.` : '',
    safeObjective ? `Objetivo comercial: ${safeObjective}.` : '',
    '',
    'Regras obrigatórias:',
    '- pesquise na web antes de responder;',
    '- use somente informações empresariais publicamente verificáveis;',
    '- não forneça telefone pessoal, dado privado ou contato inferido;',
    '- priorize site oficial, página institucional, Google Business ou diretório empresarial confiável;',
    '- não invente telefone, site, cidade ou fonte; use null quando não confirmar;',
    '- source_url deve apontar para uma página que ajude a verificar aquela empresa;',
    '- reason deve explicar em uma frase por que a empresa combina com a oferta;',
    '- confidence representa a confiança na aderência comercial e na qualidade dos dados encontrados.',
  ].filter(Boolean).join('\n');

  let apiResponse;
  try {
    apiResponse = await axios.post(
      OPENAI_RESPONSES_URL,
      {
        model,
        store: false,
        instructions: 'Você é um pesquisador B2B rigoroso. Encontre empresas reais no Brasil usando a web e nunca invente dados de contato.',
        input: prompt,
        tools: [
          {
            type: 'web_search',
            search_context_size: 'medium',
            user_location: { type: 'approximate', country: 'BR' },
          },
        ],
        include: ['web_search_call.action.sources'],
        max_output_tokens: 5000,
        text: {
          format: {
            type: 'json_schema',
            name: 'lead_discovery_results',
            strict: true,
            schema: leadSchema(safeQuantity),
          },
        },
      },
      {
        timeout: 90000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (requestError) {
    const upstreamStatus = requestError.response?.status;
    const upstreamMessage = requestError.response?.data?.error?.message;
    const error = new Error(upstreamMessage || 'Não foi possível concluir a busca com GPT.');
    error.code = 'OPENAI_REQUEST_FAILED';
    error.status = upstreamStatus === 429 ? 429 : upstreamStatus === 401 ? 503 : 502;
    throw error;
  }

  const rawText = extractOutputText(apiResponse.data);
  if (!rawText) {
    const error = new Error('O GPT não retornou resultados estruturados.');
    error.code = 'OPENAI_EMPTY_RESPONSE';
    error.status = 502;
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const error = new Error('O GPT retornou uma resposta que não pôde ser interpretada.');
    error.code = 'OPENAI_INVALID_RESPONSE';
    error.status = 502;
    throw error;
  }

  return {
    model,
    summary: parsed.summary || '',
    leads: Array.isArray(parsed.leads) ? parsed.leads.slice(0, safeQuantity) : [],
    sources: extractSources(apiResponse.data),
    query: {
      segment: safeSegment,
      location: safeLocation,
      offer: safeOffer,
      objective: safeObjective,
      quantity: safeQuantity,
    },
    generated_at: new Date().toISOString(),
  };
}

module.exports = {
  discoverLeadsWithGpt,
};
