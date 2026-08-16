require('dotenv').config();

const os = require('os');
const { pool } = require('./config/db');
const jobService = require('./services/jobService');
const campaignRunner = require('./services/campaignRunner');

const workerId = process.env.WORKER_ID || `${os.hostname()}:${process.pid}`;
const pollIntervalMs = Math.max(250, Number(process.env.JOB_POLL_INTERVAL_MS) || 2000);
const staleMinutes = Math.max(1, Number(process.env.JOB_STALE_MINUTES) || 3);
const executionTimeoutMs = Math.max(30000, Number(process.env.JOB_EXECUTION_TIMEOUT_MS) || 120000);
const recoveryIntervalMs = Math.max(30000, Number(process.env.JOB_RECOVERY_INTERVAL_MS) || 60000);

let stopping = false;
let lastRecoveryAt = 0;

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} excedeu ${Math.round(timeoutMs / 1000)}s e foi interrompido para nova tentativa.`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function recoverIfDue() {
  const now = Date.now();
  if (now - lastRecoveryAt < recoveryIntervalMs) return;
  lastRecoveryAt = now;
  const recovered = await jobService.recoverStaleJobs(staleMinutes);
  if (recovered.length > 0) console.warn(`[worker] ${recovered.length} job(s) stale recuperado(s): ${JSON.stringify(recovered)}`);
}

async function processOne() {
  await recoverIfDue();
  const claimed = await jobService.claimNext(workerId);
  if (!claimed) return false;

  const { job, execution } = claimed;
  console.log(`[worker] iniciando ${job.job_type} job=${job.id} tentativa=${job.attempts}/${job.max_attempts} timeout=${executionTimeoutMs}ms`);

  try {
    const result = await withTimeout(campaignRunner.run(job), executionTimeoutMs, `${job.job_type} job=${job.id}`);
    await jobService.complete(job.id, execution.id, result);
    console.log(`[worker] concluído ${job.job_type} job=${job.id} result=${JSON.stringify(result)}`);
  } catch (error) {
    const updated = await jobService.fail(job, execution.id, error);
    console.error(`[worker] falha ${job.job_type} job=${job.id} status=${updated.status}: ${error.message}`);
  }
  return true;
}

async function loop() {
  while (!stopping) {
    try {
      const processed = await processOne();
      if (!processed) await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
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

console.log(`[worker] ativo id=${workerId} poll=${pollIntervalMs}ms timeout=${executionTimeoutMs}ms stale=${staleMinutes}min recovery=${recoveryIntervalMs}ms`);
loop().catch(async (error) => {
  console.error('[worker] falha fatal:', error);
  await pool.end();
  process.exit(1);
});
