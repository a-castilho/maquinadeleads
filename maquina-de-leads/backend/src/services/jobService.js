const db = require('../config/db');

function normalizeError(error) {
  if (!error) return 'Erro desconhecido';
  if (typeof error === 'string') return error;
  return error.stack || error.message || JSON.stringify(error);
}

function retryDelaySeconds(attempt) {
  const base = Math.max(1, Number(process.env.JOB_RETRY_BASE_SECONDS) || 30);
  return Math.min(base * (2 ** Math.max(0, attempt - 1)), 3600);
}

async function enqueue({ nicheId = null, jobType, payload = {}, runAt = null, maxAttempts = 3 }) {
  if (!jobType) throw new Error('jobType é obrigatório.');

  const attemptsLimit = Math.max(1, Number(maxAttempts) || 3);
  const result = await db.query(
    `INSERT INTO native_jobs (niche_id, job_type, payload, run_at, max_attempts)
     VALUES ($1, $2, $3::jsonb, COALESCE($4::timestamptz, NOW()), $5)
     RETURNING *`,
    [nicheId, jobType, JSON.stringify(payload || {}), runAt, attemptsLimit]
  );

  return result.rows[0];
}

async function listForNiche(nicheId, { status = null, limit = 50 } = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const params = [nicheId];
  const conditions = ['niche_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  params.push(safeLimit);
  const result = await db.query(
    `SELECT *
       FROM native_jobs
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params
  );

  return result.rows;
}

async function getExecutions(jobId, limit = 20) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const result = await db.query(
    `SELECT *
       FROM native_job_executions
      WHERE job_id = $1
      ORDER BY started_at DESC
      LIMIT $2`,
    [jobId, safeLimit]
  );
  return result.rows;
}

async function recoverStaleJobs(staleMinutes = 15) {
  const minutes = Math.max(1, Number(staleMinutes) || 15);
  const result = await db.query(
    `UPDATE native_jobs
        SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'retry' END,
            run_at = CASE WHEN attempts >= max_attempts THEN run_at ELSE NOW() END,
            last_error = COALESCE(last_error, 'Job recuperado após lock expirado.'),
            locked_at = NULL,
            locked_by = NULL
      WHERE status = 'processing'
        AND locked_at < NOW() - ($1::text || ' minutes')::interval
      RETURNING id, status`,
    [minutes]
  );
  return result.rows;
}

async function claimNext(workerId) {
  if (!workerId) throw new Error('workerId é obrigatório.');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const selected = await client.query(
      `SELECT *
         FROM native_jobs
        WHERE status IN ('pending', 'retry')
          AND run_at <= NOW()
        ORDER BY run_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1`
    );

    if (selected.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const current = selected.rows[0];
    const claimed = await client.query(
      `UPDATE native_jobs
          SET status = 'processing',
              attempts = attempts + 1,
              locked_at = NOW(),
              locked_by = $2,
              last_error = NULL
        WHERE id = $1
        RETURNING *`,
      [current.id, workerId]
    );

    const job = claimed.rows[0];
    const execution = await client.query(
      `INSERT INTO native_job_executions (job_id, attempt, worker_id, status)
       VALUES ($1, $2, $3, 'processing')
       RETURNING *`,
      [job.id, job.attempts, workerId]
    );

    await client.query('COMMIT');
    return { job, execution: execution.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function complete(jobId, executionId, result = null) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const updatedJob = await client.query(
      `UPDATE native_jobs
          SET status = 'completed',
              completed_at = NOW(),
              locked_at = NULL,
              locked_by = NULL,
              last_error = NULL
        WHERE id = $1
        RETURNING *`,
      [jobId]
    );

    await client.query(
      `UPDATE native_job_executions
          SET status = 'completed',
              finished_at = NOW(),
              result = $2::jsonb
        WHERE id = $1`,
      [executionId, result == null ? null : JSON.stringify(result)]
    );

    await client.query('COMMIT');
    return updatedJob.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function fail(job, executionId, error) {
  const message = normalizeError(error);
  const exhausted = job.attempts >= job.max_attempts;
  const nextStatus = exhausted ? 'failed' : 'retry';
  const delaySeconds = retryDelaySeconds(job.attempts);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const updatedJob = await client.query(
      `UPDATE native_jobs
          SET status = $2,
              run_at = CASE WHEN $2 = 'retry'
                            THEN NOW() + ($3::text || ' seconds')::interval
                            ELSE run_at END,
              last_error = $4,
              completed_at = CASE WHEN $2 = 'failed' THEN NOW() ELSE NULL END,
              locked_at = NULL,
              locked_by = NULL
        WHERE id = $1
        RETURNING *`,
      [job.id, nextStatus, delaySeconds, message]
    );

    await client.query(
      `UPDATE native_job_executions
          SET status = 'failed',
              finished_at = NOW(),
              error_message = $2
        WHERE id = $1`,
      [executionId, message]
    );

    await client.query('COMMIT');
    return updatedJob.rows[0];
  } catch (dbError) {
    await client.query('ROLLBACK');
    throw dbError;
  } finally {
    client.release();
  }
}

module.exports = {
  enqueue,
  listForNiche,
  getExecutions,
  recoverStaleJobs,
  claimNext,
  complete,
  fail,
};
