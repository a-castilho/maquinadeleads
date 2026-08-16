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

  if (!niche) throw new Error('Campanha não encontrada.');
  if (niche.campaign_status !== 'running') {
    throw new Error('A campanha precisa estar em execução para enviar mensagens.');
  }
  if (!template?.body) throw new Error('Cadastre um template de mensagem ativo antes do envio.');
  if (!credential?.api_key || !credential?.base_url) {
    throw new Error('Credencial evolution_api incompleta. Configure base_url e api_key.');
  }

  return {
    niche,
    template,
    apiKey: credential.api_key,
    baseUrl: cleanEvolutionBaseUrl(credential.base_url),
    instanceName: credential.extra_config?.instanceName || credential.extra_config?.instance || niche.slug,
  };
}

async function pendingLeads(nicheId, batchSize) {
  const result = await db.query(
    `SELECT l.id, l.nome_perfil, l.whatsapp, l.lead_score, l.funnel_stage
       FROM leads l
       JOIN niches n ON n.id = l.niche_id
      WHERE l.niche_id = $1
        AND l.status = 'pendente'
        AND l.ultima_mensagem_enviada IS NULL
        AND l.whatsapp IS NOT NULL
        AND l.lead_score IS NOT NULL
        AND l.lead_score >= n.min_lead_score
        AND l.funnel_stage IN ('qualified', 'ready_for_contact')
        AND NOT EXISTS (
          SELECT 1
            FROM native_message_outbox o
           WHERE o.niche_id = l.niche_id
             AND o.lead_id = l.id
             AND o.message_kind = 'initial'
             AND o.status IN ('reserved', 'sending', 'sent', 'unknown')
        )
      ORDER BY l.lead_score DESC, l.created_at ASC
      LIMIT $2`,
    [nicheId, batchSize]
  );
  return result.rows;
}

async function reserveOutbox({ nicheId, lead, template, number, message }) {
  const idempotencyKey = `initial:${nicheId}:${lead.id}`;
  const requestPayload = {
    number,
    templateId: template.id,
    text: message,
  };

  const result = await db.query(
    `INSERT INTO native_message_outbox
       (niche_id, lead_id, template_id, message_kind, idempotency_key, status, request_payload)
     VALUES ($1, $2, $3, 'initial', $4, 'reserved', $5::jsonb)
     ON CONFLICT (idempotency_key)
     DO UPDATE SET
       template_id = EXCLUDED.template_id,
       request_payload = EXCLUDED.request_payload,
       status = 'reserved',
       last_error = NULL,
       response_payload = NULL,
       response_status = NULL,
       sending_at = NULL,
       sent_at = NULL,
       updated_at = NOW()
     WHERE native_message_outbox.status = 'failed'
     RETURNING *`,
    [nicheId, lead.id, template.id, idempotencyKey, JSON.stringify(requestPayload)]
  );

  return result.rows[0] || null;
}

async function markSending(outboxId) {
  const result = await db.query(
    `UPDATE native_message_outbox
        SET status = 'sending',
            attempts = attempts + 1,
            sending_at = NOW(),
            updated_at = NOW()
      WHERE id = $1 AND status = 'reserved'
      RETURNING *`,
    [outboxId]
  );
  return result.rows[0] || null;
}

async function markSent({ outboxId, leadId, response }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE native_message_outbox
          SET status = 'sent',
              response_status = $2,
              response_payload = $3::jsonb,
              sent_at = NOW(),
              last_error = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [
        outboxId,
        response?.status || 200,
        JSON.stringify(response?.data == null ? {} : response.data),
      ]
    );

    await client.query(
      `UPDATE leads
          SET status = 'enviado',
              funnel_stage = CASE
                WHEN funnel_stage IN ('responded', 'interested', 'converted', 'discarded') THEN funnel_stage
                ELSE 'contacted'
              END,
              ultima_mensagem_enviada = NOW(),
              updated_at = NOW()
        WHERE id = $1`,
      [leadId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function classifyFailure(error) {
  const status = error.response?.status || null;
  // Se o servidor respondeu com 4xx sabemos que a requisição foi rejeitada.
  // Timeout, conexão interrompida e 5xx são tratados como ambíguos para evitar
  // reenvio automático e mensagem duplicada.
  const outboxStatus = status && status >= 400 && status < 500 ? 'failed' : 'unknown';
  return { status, outboxStatus };
}

async function markFailure({ outboxId, leadId, error }) {
  const { status, outboxStatus } = classifyFailure(error);
  const message = error.response?.data
    ? JSON.stringify(error.response.data).slice(0, 2000)
    : String(error.message || 'Falha no envio').slice(0, 2000);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE native_message_outbox
          SET status = $2,
              response_status = $3,
              response_payload = $4::jsonb,
              last_error = $5,
              updated_at = NOW()
        WHERE id = $1`,
      [
        outboxId,
        outboxStatus,
        status,
        JSON.stringify(error.response?.data == null ? {} : error.response.data),
        message,
      ]
    );

    await client.query(
      `UPDATE leads
          SET status = 'erro',
              observacao = CASE
                WHEN $2 = 'unknown' THEN 'Envio com resultado ambíguo; revisão manual necessária para evitar duplicidade.'
                ELSE observacao
              END,
              updated_at = NOW()
        WHERE id = $1`,
      [leadId, outboxStatus]
    );

    await client.query('COMMIT');
    return outboxStatus;
  } catch (dbError) {
    await client.query('ROLLBACK');
    throw dbError;
  } finally {
    client.release();
  }
}

async function sendBatch(nicheId, options = {}) {
  const config = await loadConfig(nicheId);
  const batchSize = Math.min(50, Math.max(1, Number(options.batchSize) || 10));
  const timeout = Math.max(3000, Number(process.env.EVOLUTION_HTTP_TIMEOUT_MS) || 15000);
  const leads = await pendingLeads(nicheId, batchSize);

  let sent = 0;
  let failed = 0;
  let unknown = 0;
  let invalid = 0;
  let skipped = 0;

  for (const lead of leads) {
    const number = normalizeBrazilianPhone(lead.whatsapp);
    if (!number) {
      invalid += 1;
      failed += 1;
      await db.query(
        `UPDATE leads SET status = 'erro', observacao = 'WhatsApp inválido para envio.', updated_at = NOW()
          WHERE id = $1`,
        [lead.id]
      );
      continue;
    }

    const message = renderMessage(config.template.body, lead.nome_perfil);
    const outbox = await reserveOutbox({
      nicheId,
      lead,
      template: config.template,
      number,
      message,
    });

    if (!outbox) {
      skipped += 1;
      continue;
    }

    const sending = await markSending(outbox.id);
    if (!sending) {
      skipped += 1;
      continue;
    }

    const url = `${config.baseUrl}/message/sendText/${encodeURIComponent(config.instanceName)}`;

    try {
      const response = await axios.post(
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

      await markSent({ outboxId: outbox.id, leadId: lead.id, response });
      sent += 1;
    } catch (error) {
      const status = await markFailure({ outboxId: outbox.id, leadId: lead.id, error });
      if (status === 'unknown') unknown += 1;
      else failed += 1;
      console.error(`[messaging] falha lead=${lead.id} status=${status}:`, error.message);
    }
  }

  return {
    nicheId,
    selected: leads.length,
    sent,
    failed,
    unknown,
    invalid,
    skipped,
    threshold: Number(config.niche.min_lead_score || 55),
  };
}

module.exports = {
  sendBatch,
  normalizeBrazilianPhone,
  renderMessage,
  classifyFailure,
};
