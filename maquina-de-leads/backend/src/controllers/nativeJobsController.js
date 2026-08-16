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

  const activeJob = await db.query(
    `SELECT id, status, created_at
       FROM native_jobs
      WHERE niche_id = $1
        AND job_type = 'campaign.discover_leads'
        AND status IN ('pending', 'processing', 'retry')
      ORDER BY created_at DESC
      LIMIT 1`,
    [nicheId]
  );

  if (activeJob.rows[0]) {
    return res.status(409).json({
      error: 'Já existe uma descoberta em andamento para este nicho.',
      job: activeJob.rows[0],
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

module.exports = { startDiscovery, list, executions };
