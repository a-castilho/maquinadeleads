const axios = require('axios');
const db = require('../config/db');

const VALID_DDDS = new Set([
  11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,
  41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,
  71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99,
]);

function normalizeBrazilianPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('55')) {
    const local = digits.slice(2);
    if (local.length === 11 && VALID_DDDS.has(Number(local.slice(0, 2)))) return digits;
    if (local.length === 10 && VALID_DDDS.has(Number(local.slice(0, 2)))) {
      return `55${local.slice(0, 2)}9${local.slice(2)}`;
    }
    return null;
  }

  if (digits.length === 11 && VALID_DDDS.has(Number(digits.slice(0, 2)))) return `55${digits}`;
  if (digits.length === 10 && VALID_DDDS.has(Number(digits.slice(0, 2)))) {
    return `55${digits.slice(0, 2)}9${digits.slice(2)}`;
  }
  return null;
}

function renderMessage(template, profileName) {
  const firstNameRaw = String(profileName || '').split(' ')[0].replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const firstName = firstNameRaw.length > 2 ? firstNameRaw : 'tudo bem';
  return String(template || '')
    .replace(/\{\{\s*nome\s*\}\}/gi, firstName)
    .replace(/\{\s*nome\s*\}/gi, firstName)
    .replace(/\[\s*NOME\s*\]/gi, firstName);
}

function cleanEvolutionBaseUrl(baseUrl) {
  return String(baseUrl || '')
    .trim()
    .replace(/\/$/, '')
    .replace(/\/message\/sendText.*$/i, '');
}

async function loadConfig(nicheId) {
  const [nicheResult, templateResult, credentialResult] = await Promise.all([
    db.query('SELECT * FROM niches WHERE id = $1', [nicheId]),
    db.query(
      `SELECT * FROM message_templates
        WHERE niche_id = $1 AND active = true
        ORDER BY created_at DESC
        LIMIT 1`,
      [nicheId]
    ),
    db.query(
      `SELECT * FROM credentials
        WHERE niche_id = $1 AND provider = 'evolution_api'
        LIMIT 1`,
      [nicheId]
    ),
  ]);

  const niche = nicheResult.rows[0];
  const template = templateResult.rows[0];
  const credential = credentialResult.rows[0];

  if (!niche) throw new Error('Nicho não encontrado.');
  if (!template?.body) throw new Error('Cadastre um template de mensagem ativo antes do envio.');
  if (!credential?.api_key || !credential?.base_url) {
    throw new Error('Credencial evolution_api incompleta. Configure base_url e api_key.');
  }

  return {
    niche,
    template,
    apiKey: credential.api_key,
    baseUrl: cleanEvolutionBaseUrl(credential.base_url),
    instanceName: credential.extra_config?.instanceName || niche.slug,
  };
}

async function pendingLeads(nicheId, batchSize) {
  const result = await db.query(
    `SELECT id, nome_perfil, whatsapp
       FROM leads
      WHERE niche_id = $1
        AND status = 'pendente'
        AND ultima_mensagem_enviada IS NULL
      ORDER BY created_at ASC
      LIMIT $2`,
    [nicheId, batchSize]
  );
  return result.rows;
}

async function markSent(leadId) {
  await db.query(
    `UPDATE leads
        SET status = 'enviado',
            ultima_mensagem_enviada = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [leadId]
  );
}

async function markError(leadId) {
  await db.query(
    `UPDATE leads
        SET status = 'erro',
            updated_at = NOW()
      WHERE id = $1`,
    [leadId]
  );
}

async function sendBatch(nicheId, options = {}) {
  const config = await loadConfig(nicheId);
  const batchSize = Math.min(50, Math.max(1, Number(options.batchSize) || 10));
  const timeout = Math.max(3000, Number(process.env.EVOLUTION_HTTP_TIMEOUT_MS) || 15000);
  const leads = await pendingLeads(nicheId, batchSize);

  let sent = 0;
  let failed = 0;
  let invalid = 0;

  for (const lead of leads) {
    const number = normalizeBrazilianPhone(lead.whatsapp);
    if (!number) {
      invalid += 1;
      failed += 1;
      await markError(lead.id);
      continue;
    }

    const message = renderMessage(config.template.body, lead.nome_perfil);
    const url = `${config.baseUrl}/message/sendText/${encodeURIComponent(config.instanceName)}`;

    try {
      await axios.post(
        url,
        {
          number,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text: message },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            apikey: config.apiKey,
          },
          timeout,
        }
      );
      await markSent(lead.id);
      sent += 1;
    } catch (error) {
      await markError(lead.id);
      failed += 1;
      console.error(`[messaging] falha lead=${lead.id}:`, error.response?.data || error.message);
    }
  }

  return {
    nicheId,
    selected: leads.length,
    sent,
    failed,
    invalid,
  };
}

module.exports = {
  sendBatch,
  normalizeBrazilianPhone,
  renderMessage,
};
