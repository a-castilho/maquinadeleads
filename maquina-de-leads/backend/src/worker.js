require('dotenv').config();

const os = require('os');
const { pool } = require('./config/db');
const jobService = require('./services/jobService');
const campaignRunner = require('./services/campaignRunner');

const workerId = process.env.WORKER_ID || `${os.hostname()}:${process.pid}`;
const pollIntervalMs = Math.max(250, Number(process.env.JOB_POLL_INTERVAL_MS) || 2000);
const staleMinutes = Math.max(1, Number(process.env.JOB_STALE_MINUTES) || 15);

let stopping = false;
let recoveredOnce = false;

async function processOne() {
  if (!recoveredOnce) {
    const recovered = await jobService.recoverStaleJobs(staleMinutes);
    if (recovered.length > 0) {
      console.warn(`[worker] ${recovered.length} job(s) stale recuperado(s).`);
    }
    recoveredOnce = true;
  }

  const claimed = await jobService.claimNext(workerId);
  if (!claimed) return false;

  const { job, execution } = claimed;
  console.log(`[worker] iniciando ${job.job_type} job=${job.id} tentativa=${job.attempts}`);

  try {
    const result = await campaignRunner.run(job);
    await jobService.complete(job.id, execution.id, result);
    console.log(`[worker] concluído ${job.job_type} job=${job.id}`);
  } catch (error) {
    const updated = await jobService.fail(job, execution.id, error);
    console.error(
      `[worker] falha ${job.job_type} job=${job.id} status=${updated.status}:`,
      error.message
    );
  }

  return true;
}

async function loop() {
  while (!stopping) {
    try {
      const processed = await processOne();
      if (!processed) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    } catch (error) {
      console.error('[worker] erro no loop:', error);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[worker] encerrando por ${signal}...`);
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log(`[worker] ativo id=${workerId} poll=${pollIntervalMs}ms`);
loop().catch(async (error) => {
  console.error('[worker] falha fatal:', error);
  await pool.end();
  process.exit(1);
});
