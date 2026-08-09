/**
 * Gera o JSON do workflow n8n de ENVIO de mensagens WhatsApp para um nicho.
 */
function buildSendingWorkflow(config) {
  const {
    nicheId,
    nicheName,
    messageTemplate,
    evolutionBaseUrl,
    evolutionInstance,
    evolutionApiKey,
    postgresCredentialId,
    scheduleHours = 1,
    batchSize = 10,
  } = config;

  // Sanitiza a URL base removendo barras finais e caminhos duplicados da Evolution API
  const cleanBaseUrl = (evolutionBaseUrl || '')
    .trim()
    .replace(/\/$/, '')
    .replace(/\/message\/sendText.*$/i, '');

  const formataCelCode = `
const ddds = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);
const TEMPLATE = ${JSON.stringify(messageTemplate)};
const out = [];

for (const item of $input.all()) {
  const j = item.json;
  const d = String(j.whatsapp || '').replace(/\\D/g, '');
  let num = null;

  if (d.startsWith('55')) {
    const r = d.slice(2);
    if (r.length === 11 && ddds.has(parseInt(r.slice(0,2)))) num = d;
    else if (r.length === 10 && ddds.has(parseInt(r.slice(0,2)))) num = '55' + r.slice(0,2) + '9' + r.slice(2);
  } else {
    if (d.length === 11 && ddds.has(parseInt(d.slice(0,2)))) num = '55' + d;
    else if (d.length === 10 && ddds.has(parseInt(d.slice(0,2)))) num = '55' + d.slice(0,2) + '9' + d.slice(2);
  }

  if (num) {
    let primeiroNome = j.nome_perfil ? j.nome_perfil.split(' ')[0].replace(/[^\\w\\s]/gi, '').trim() : '';
    const nomeFinal = primeiroNome && primeiroNome.length > 2 ? primeiroNome : 'tudo bem';

    // Suporta substituição de {{nome}}, {nome} e [NOME]
    const msg = TEMPLATE
      .replace(/\\{\\{\\s*nome\\s*\\}\\}/gi, nomeFinal)
      .replace(/\\{\\s*nome\\s*\\}/gi, nomeFinal)
      .replace(/\\[\\s*NOME\\s*\\]/gi, nomeFinal);

    out.push({ json: { ...j, numeroCorrigido: num, mensagem: msg } });
  }
}
return out;
`.trim();

  const nodes = [
    {
      id: 'trigger',
      name: 'Schedule Trigger',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.3,
      position: [0, 0],
      parameters: { rule: { interval: [{ field: 'hours', hoursInterval: scheduleHours }] } },
    },
    {
      id: 'webhook',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [0, 150],
      parameters: {
        httpMethod: 'GET',
        path: `envio-${nicheId}`,
        responseMode: 'onReceived',
        options: {}
      },
    },
    {
      id: 'puxa',
      name: 'Puxa Leads Pendentes',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [220, 0],
      parameters: {
        operation: 'executeQuery',
        query: `SELECT id, nome_perfil, whatsapp FROM leads WHERE niche_id = '${nicheId}' AND status = 'pendente' AND ultima_mensagem_enviada IS NULL LIMIT ${batchSize};`,
      },
      credentials: postgresCredentialId ? { postgres: { id: postgresCredentialId, name: 'Postgres account' } } : undefined,
    },
    {
      id: 'formata',
      name: 'formataCel',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [440, 0],
      parameters: { jsCode: formataCelCode },
    },
    {
      id: 'envia',
      name: 'Envia WhatsApp',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [660, 0],
      onError: 'continueErrorOutput',
      parameters: {
        method: 'POST',
        url: `${cleanBaseUrl}/message/sendText/${evolutionInstance}`,
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'apikey', value: evolutionApiKey },
          ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ number: $json.numeroCorrigido, options: { delay: 1200, presence: "composing" }, textMessage: { text: $json.mensagem } }) }}',
      },
    },
    {
      id: 'sucesso',
      name: 'Atualiza Enviado',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [880, -100],
      parameters: {
        operation: 'executeQuery',
        query: "UPDATE leads SET status = 'enviado', ultima_mensagem_enviada = NOW() WHERE id = '{{ $('formataCel').item.json.id }}';",
      },
      credentials: postgresCredentialId ? { postgres: { id: postgresCredentialId, name: 'Postgres account' } } : undefined,
    },
    {
      id: 'erro',
      name: 'Atualiza Erro',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [880, 100],
      parameters: {
        operation: 'executeQuery',
        query: "UPDATE leads SET status = 'erro' WHERE id = '{{ $('formataCel').item.json.id }}';",
      },
      credentials: postgresCredentialId ? { postgres: { id: postgresCredentialId, name: 'Postgres account' } } : undefined,
    },
  ];

  const connections = {
    'Schedule Trigger': { main: [[{ node: 'Puxa Leads Pendentes', type: 'main', index: 0 }]] },
    'Webhook': { main: [[{ node: 'Puxa Leads Pendentes', type: 'main', index: 0 }]] },
    'Puxa Leads Pendentes': { main: [[{ node: 'formataCel', type: 'main', index: 0 }]] },
    'formataCel': { main: [[{ node: 'Envia WhatsApp', type: 'main', index: 0 }]] },
    'Envia WhatsApp': {
      main: [
        [{ node: 'Atualiza Enviado', type: 'main', index: 0 }],
        [{ node: 'Atualiza Erro', type: 'main', index: 0 }],
      ],
    },
  };

  return {
    name: `[Máquina de Leads] Envio - ${nicheName}`,
    nodes,
    connections,
    settings: { executionOrder: 'v1' },
    active: false,
  };
}

module.exports = { buildSendingWorkflow };
