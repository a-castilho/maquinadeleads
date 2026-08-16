const db = require('../config/db');
const { assertNicheOwnership } = require('../utils/ownership');
const jobService = require('../services/jobService');

async function ensureOwnership(nicheId, userId, res) {
  if (!(await assertNicheOwnership(nicheId, userId))) {
    res.status(404).json({ error: 'Nicho não encontrado.' });
    return false;
  }
  return true;
}

async function findActiveJob(nicheId, jobType) {
  const result = await db.query(
    `SELECT id, status, created_at
       FROM native_jobs
      WHERE niche_id = $1
        AND job_type = $2
        AND status IN ('pending', 'processing', 'retry')
      ORDER BY created_at DESC
      LIMIT 1`,
    [nicheId, jobType]
  );
  return result.rows[0] || null;
}

async function startDiscovery(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const maxQueries = Math.min(50, Math.max(1, Number(req.body?.maxQueries) || 50));
  const keywordCount = await db.query(
    `SELECT COUNT(*)::int AS total
       FROM keywords
      WHERE niche_id = $1
        AND kind = 'nicho'
        AND active = true`,
    [nicheId]
  );

  if (keywordCount.rows[0].total === 0) {
    return res.status(400).json({ error: 'Cadastre ao menos uma palavra-chave de nicho antes de iniciar a descoberta.' });
  }

  const activeJob = await findActiveJob(nicheId, 'campaign.discover_leads');
  if (activeJob) {
    return res.status(409).json({
      error: 'Já existe uma descoberta em andamento para este nicho.',
      job: activeJob,
    });
  }

  const job = await jobService.enqueue({
    nicheId,
    jobType: 'campaign.discover_leads',
    payload: { maxQueries },
    maxAttempts: 3,
  });

  res.status(202).json({ job });
}

async function startSending(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const batchSize = Math.min(50, Math.max(1, Number(req.body?.batchSize) || 10));
  const [template, credential, pending] = await Promise.all([
    db.query(
      `SELECT id FROM message_templates
        WHERE niche_id = $1 AND active = true
        ORDER BY created_at DESC LIMIT 1`,
      [nicheId]
    ),
    db.query(
      `SELECT id FROM credentials
        WHERE niche_id = $1
          AND provider = 'evolution_api'
          AND api_key IS NOT NULL
          AND base_url IS NOT NULL
        LIMIT 1`,
      [nicheId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total FROM leads
        WHERE niche_id = $1
          AND status = 'pendente'
          AND ultima_mensagem_enviada IS NULL`,
      [nicheId]
    ),
  ]);

  if (!template.rows[0]) return res.status(400).json({ error: 'Cadastre um template de mensagem ativo antes do envio.' });
  if (!credential.rows[0]) return res.status(400).json({ error: 'Configure a credencial evolution_api antes do envio.' });
  if (pending.rows[0].total === 0) return res.status(400).json({ error: 'Não há leads pendentes para envio.' });

  const activeJob = await findActiveJob(nicheId, 'campaign.send_messages');
  if (activeJob) {
    return res.status(409).json({
      error: 'Já existe um envio em andamento para este nicho.',
      job: activeJob,
    });
  }

  const job = await jobService.enqueue({
    nicheId,
    jobType: 'campaign.send_messages',
    payload: { batchSize },
    maxAttempts: 2,
  });

  res.status(202).json({ job });
}

async function list(req, res) {
  const { nicheId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const jobs = await jobService.listForNiche(nicheId, {
    status: req.query.status || null,
    limit: req.query.limit || 50,
  });

  res.json({ jobs });
}

async function executions(req, res) {
  const { nicheId, jobId } = req.params;
  if (!(await ensureOwnership(nicheId, req.user.sub, res))) return;

  const job = await db.query(
    'SELECT id FROM native_jobs WHERE id = $1 AND niche_id = $2',
    [jobId, nicheId]
  );
  if (!job.rows[0]) return res.status(404).json({ error: 'Job não encontrado.' });

  const items = await jobService.getExecutions(jobId, req.query.limit || 20);
  res.json({ executions: items });
}

module.exports = { startDiscovery, startSending, list, executions };
