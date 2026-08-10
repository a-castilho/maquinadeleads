/**
 * Gera o JSON do workflow n8n de ENRIQUECIMENTO de leads: visita o link
 * (fonte_url) de cada lead e tenta extrair email, telefone e uma descricao
 * extra (bio/legenda/trecho da pagina).
 *
 * IMPORTANTE - limitacao conhecida: Instagram e Facebook bloqueiam
 * scraping direto sem login. O que ainda funciona sem custo:
 *   - tags og:description / og:title (metadados publicos para preview de
 *     link) - normalmente trazem legenda do post + contagem de likes/
 *     comentarios, MAS NAO o texto dos comentarios em si.
 *   - Para sites genericos (vagas, institucionais), o HTML completo esta
 *     disponivel, entao email/telefone/descricao funcionam bem.
 *
 * @param {Object} config
 * @param {string} config.nicheId
 * @param {string} config.nicheName
 * @param {string} config.postgresCredentialId
 * @param {number} config.scheduleHours
 * @param {number} config.batchSize
 * @param {string} config.webhookPath
 */
function buildEnrichmentWorkflow(config) {
  const {
    nicheId,
    nicheName,
    postgresCredentialId,
    scheduleHours = 3,
    batchSize = 15,
    webhookPath,
  } = config;

  const extraiInfoCode = `
function extrairHtml(item) {
  // n8n pode devolver o corpo em campos diferentes dependendo da versao
  // e do content-type detectado. Checamos os mais comuns.
  if (typeof item.json === 'string') return item.json;
  if (typeof item.json.data === 'string') return item.json.data;
  if (typeof item.json.body === 'string') return item.json.body;
  return '';
}

function extrairMetaTag(html, prop) {
  const re = new RegExp('<meta[^>]+(?:property|name)=["\\']' + prop + '["\\'][^>]+content=["\\']([^"\\']*)["\\']', 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

function extrairEmail(texto) {
  if (!texto) return null;
  const m = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

function extrairTelefone(texto) {
  if (!texto) return null;
  const candidatos = texto.match(/(?:\\+?55[\\s.\\-]?)?\\(?\\d{2}\\)?[\\s.\\-]?9?[\\s.\\-]?\\d{4}[\\s.\\-]?\\d{4}/g) || [];
  for (const c of candidatos) {
    let digits = c.replace(/\\D/g, '');
    if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);
    if (digits.length === 10 || digits.length === 11) return '55' + digits;
  }
  return null;
}

const items = $input.all();
const out = [];

for (const item of items) {
  const id = item.json.__leadId;
  const fonteUrl = item.json.__fonteUrl || '';
  const errorInfo = item.json.error;

  if (errorInfo) {
    out.push({ json: { id, email: null, descricao_extra: null, telefone_encontrado: null, enrichment_status: 'sem_dados' } });
    continue;
  }

  const html = extrairHtml(item);
  if (!html) {
    out.push({ json: { id, email: null, descricao_extra: null, telefone_encontrado: null, enrichment_status: 'sem_dados' } });
    continue;
  }

  const isRedeSocial = /instagram\\.com|facebook\\.com/i.test(fonteUrl);

  let descricao = extrairMetaTag(html, 'og:description') || extrairMetaTag(html, 'description');
  const ogTitle = extrairMetaTag(html, 'og:title');
  if (!descricao && ogTitle) descricao = ogTitle;
  descricao = descricao ? descricao.slice(0, 500).replace(/'/g, "''") : null;

  const email = extrairEmail(html) || extrairEmail(descricao);
  const telefone = extrairTelefone(html) || extrairTelefone(descricao);

  const status = (email || telefone || descricao) ? 'enriquecido' : 'sem_dados';

  out.push({
    json: {
      id,
      email: email || null,
      descricao_extra: descricao || null,
      telefone_encontrado: telefone || null,
      enrichment_status: status,
    }
  });
}
return out;
`.trim();

  const nodes = [
    {
      id: 'trigger', name: 'Schedule Trigger', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.3,
      position: [0, 0], parameters: { rule: { interval: [{ field: 'hours', hoursInterval: scheduleHours }] } },
    },
    {
      id: 'webhook', name: 'Webhook Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2,
      position: [0, 200],
      parameters: {
        path: webhookPath || `enriquecimento-${nicheId}`,
        httpMethod: 'GET',
        responseMode: 'onReceived',
        options: {},
      },
    },
    {
      id: 'puxa', name: 'Puxa Leads Para Enriquecer', type: 'n8n-nodes-base.postgres', typeVersion: 2.6,
      position: [220, 100],
      parameters: {
        operation: 'executeQuery',
        query: `SELECT id, fonte_url FROM leads WHERE niche_id = '${nicheId}' AND fonte_url IS NOT NULL AND (enrichment_status = 'pendente' OR enrichment_status IS NULL) LIMIT ${batchSize};`,
      },
      credentials: postgresCredentialId ? { postgres: { id: postgresCredentialId, name: 'Postgres account' } } : undefined,
    },
    {
      id: 'prepara', name: 'Prepara Requisicao', type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [440, 100],
      parameters: {
        jsCode: `return $input.all().map(item => ({ json: { __leadId: item.json.id, __fonteUrl: item.json.fonte_url, url: item.json.fonte_url } }));`,
      },
    },
    {
      id: 'busca', name: 'Busca Pagina do Link', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [660, 100], onError: 'continueRegularOutput',
      parameters: {
        url: '={{ $json.url }}',
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
        ] },
        options: {
          response: { response: { responseFormat: 'text' } },
          timeout: 15000,
        },
      },
    },
    {
      id: 'passa_dados', name: 'Junta Dados', type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [660, 300],
      parameters: {
        jsCode: `
const prepared = $('Prepara Requisicao').all();
const fetched = $input.all();
return fetched.map((item, i) => ({
  json: {
    ...item.json,
    __leadId: prepared[i]?.json.__leadId,
    __fonteUrl: prepared[i]?.json.__fonteUrl,
  }
}));
`.trim(),
      },
    },
    {
      id: 'extrai', name: 'Extrai Info', type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [880, 300], parameters: { jsCode: extraiInfoCode },
    },
    {
      id: 'atualiza', name: 'Atualiza Lead', type: 'n8n-nodes-base.postgres', typeVersion: 2.6,
      position: [1100, 300],
      parameters: {
        operation: 'executeQuery',
        query: `UPDATE leads SET
  email = {{ $json.email ? "'" + String($json.email).replace(/'/g, "''") + "'" : 'NULL' }},
  descricao_extra = {{ $json.descricao_extra ? "'" + String($json.descricao_extra).replace(/'/g, "''") + "'" : 'NULL' }},
  whatsapp = COALESCE(whatsapp, {{ $json.telefone_encontrado ? "'" + String($json.telefone_encontrado).replace(/'/g, "''") + "'" : 'NULL' }}),
  enrichment_status = '{{ $json.enrichment_status }}',
  enriched_at = NOW()
WHERE id = '{{ $json.id }}';`,
      },
      credentials: postgresCredentialId ? { postgres: { id: postgresCredentialId, name: 'Postgres account' } } : undefined,
    },
  ];

  const connections = {
    'Schedule Trigger': { main: [[{ node: 'Puxa Leads Para Enriquecer', type: 'main', index: 0 }]] },
    'Webhook Trigger': { main: [[{ node: 'Puxa Leads Para Enriquecer', type: 'main', index: 0 }]] },
    'Puxa Leads Para Enriquecer': { main: [[{ node: 'Prepara Requisicao', type: 'main', index: 0 }]] },
    'Prepara Requisicao': { main: [[{ node: 'Busca Pagina do Link', type: 'main', index: 0 }]] },
    'Busca Pagina do Link': { main: [[{ node: 'Junta Dados', type: 'main', index: 0 }]] },
    'Junta Dados': { main: [[{ node: 'Extrai Info', type: 'main', index: 0 }]] },
    'Extrai Info': { main: [[{ node: 'Atualiza Lead', type: 'main', index: 0 }]] },
  };

  return {
    name: `[Máquina de Leads] Enriquecimento - ${nicheName}`,
    nodes,
    connections,
    settings: { executionOrder: 'v1' },
    active: false,
  };
}

module.exports = { buildEnrichmentWorkflow };
