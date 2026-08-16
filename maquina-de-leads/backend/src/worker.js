require('dotenv').config();
const db = require('./config/db');
const { discoverLeads } = require('./services/campaignService');

const POLL_MS = Number(process.env.WORKER_POLL_MS || 3000);
let stopping = false;

async function claimJob() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      SELECT j.*, row_to_json(c.*) AS campaign
      FROM campaign_jobs j
      JOIN campaigns c ON c.id=j.campaign_id
      WHERE j.status IN ('queued','retry') AND j.run_after <= NOW()
      ORDER BY j.created_at ASC
      FOR UPDATE OF j SKIP LOCKED
      LIMIT 1
    `);
    const job = result.rows[0];
    if (!job) { await client.query('COMMIT'); return null; }
    await client.query("UPDATE campaign_jobs SET status='running', attempts=attempts+1, started_at=NOW(), error=NULL WHERE id=$1", [job.id]);
    await client.query("UPDATE campaigns SET status='running', started_at=COALESCE(started_at,NOW()) WHERE id=$1", [job.campaign_id]);
    await client.query('COMMIT');
    return job;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

async function execute(job) {
  try {
    let result;
    if (job.type === 'lead_discovery') result = await discoverLeads(job.campaign);
    else throw new Error(`Tipo de job não suportado: ${job.type}`);

    await db.query("UPDATE campaign_jobs SET status='done', result=$1, finished_at=NOW() WHERE id=$2", [JSON.stringify(result || {}), job.id]);
    await db.query("UPDATE campaigns SET status='paused' WHERE id=$1 AND status='running'", [job.campaign_id]);
    console.log(`[worker] job ${job.id} concluído`, result);
  } catch (err) {
    const retry = Number(job.attempts || 0) + 1 < Number(job.max_attempts || 3);
    await db.query(
      `UPDATE campaign_jobs SET status=$1,error=$2,finished_at=CASE WHEN $1='failed' THEN NOW() ELSE NULL END,
       run_after=CASE WHEN $1='retry' THEN NOW() + INTERVAL '30 seconds' ELSE run_after END WHERE id=$3`,
      [retry ? 'retry' : 'failed', err.message, job.id]
    );
    if (!retry) await db.query("UPDATE campaigns SET status='error' WHERE id=$1", [job.campaign_id]);
    console.error(`[worker] job ${job.id} falhou:`, err.message);
  }
}

async function loop() {
  console.log('⚙️ Worker nativo da Máquina de Leads iniciado.');
  while (!stopping) {
    try {
      const job = await claimJob();
      if (job) await execute(job);
      else await new Promise(r => setTimeout(r, POLL_MS));
    } catch (err) {
      console.error('[worker] erro no loop:', err.message);
      await new Promise(r => setTimeout(r, POLL_MS));
    }
  }
  await db.pool.end();
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
loop();
