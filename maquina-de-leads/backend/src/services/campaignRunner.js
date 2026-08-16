const leadDiscoveryService = require('./resilientLeadDiscoveryService');
const messagingService = require('./messagingService');
const enrichmentService = require('./enrichmentService');
const leadScoringService = require('./leadScoringService');
const jobService = require('./jobService');

class CampaignRunner {
  constructor() {
    this.handlers = new Map();
  }

  register(jobType, handler) {
    if (!jobType) throw new Error('jobType é obrigatório.');
    if (typeof handler !== 'function') throw new Error(`Handler inválido para ${jobType}.`);
    this.handlers.set(jobType, handler);
    return this;
  }

  has(jobType) {
    return this.handlers.has(jobType);
  }

  async run(job) {
    const handler = this.handlers.get(job.job_type);
    if (!handler) {
      throw new Error(`Nenhum handler nativo registrado para o job "${job.job_type}".`);
    }

    return handler({
      job,
      nicheId: job.niche_id,
      payload: job.payload || {},
    });
  }
}

async function enqueuePipelineStage(nicheId, jobType, payload, maxAttempts = 2) {
  const job = await jobService.enqueueUnique({ nicheId, jobType, payload, maxAttempts });
  if (job) {
    console.log(`[native-pipeline] niche=${nicheId} next=${jobType} job=${job.id}`);
  } else {
    console.log(`[native-pipeline] niche=${nicheId} next=${jobType} skipped=already-active`);
  }
  return job;
}

const runner = new CampaignRunner();

runner.register('system.noop', async ({ payload }) => ({ ok: true, payload }));

runner.register('campaign.discover_leads', async ({ nicheId, payload }) => {
  if (!nicheId) throw new Error('Job de descoberta sem niche_id.');
  const discovery = await leadDiscoveryService.discover(nicheId, payload);

  let nextJob = null;
  if (payload.autoPipeline) {
    nextJob = await enqueuePipelineStage(
      nicheId,
      'campaign.enrich_leads',
      {
        batchSize: payload.enrichBatchSize || 25,
        autoPipeline: true,
        scoreBatchSize: payload.scoreBatchSize || 500,
      },
      2
    );
  }

  return { ...discovery, pipeline: Boolean(payload.autoPipeline), nextJobId: nextJob?.id || null };
});

runner.register('campaign.enrich_leads', async ({ nicheId, payload }) => {
  if (!nicheId) throw new Error('Job de enriquecimento sem niche_id.');
  const enrichment = await enrichmentService.enrichBatch(nicheId, payload);

  let nextJob = null;
  if (payload.autoPipeline) {
    nextJob = await enqueuePipelineStage(
      nicheId,
      'campaign.score_leads',
      { batchSize: payload.scoreBatchSize || 500, force: true, autoPipeline: true },
      2
    );
  }

  return { ...enrichment, pipeline: Boolean(payload.autoPipeline), nextJobId: nextJob?.id || null };
});

runner.register('campaign.score_leads', async ({ nicheId, payload }) => {
  if (!nicheId) throw new Error('Job de scoring sem niche_id.');
  const scoring = await leadScoringService.scoreBatch(nicheId, payload);
  if (payload.autoPipeline) {
    console.log(`[native-pipeline] niche=${nicheId} preparation=completed`);
  }
  return { ...scoring, pipeline: Boolean(payload.autoPipeline), preparationCompleted: Boolean(payload.autoPipeline) };
});

runner.register('campaign.send_messages', async ({ nicheId, payload }) => {
  if (!nicheId) throw new Error('Job de envio sem niche_id.');
  return messagingService.sendBatch(nicheId, payload);
});

// Ciclo operacional usado após a ativação. Primeiro recalcula leads que mudaram
// desde o último score e só então envia aos qualificados.
runner.register('campaign.process_batch', async ({ nicheId, payload }) => {
  if (!nicheId) throw new Error('Job de processamento sem niche_id.');

  console.log(`[native-pipeline] niche=${nicheId} process_batch=start`);
  const scoring = await leadScoringService.scoreBatch(nicheId, {
    batchSize: payload.scoreBatchSize || 500,
    force: false,
  });

  const messaging = await messagingService.sendBatch(nicheId, {
    batchSize: payload.sendBatchSize || 25,
  });

  console.log(`[native-pipeline] niche=${nicheId} process_batch=completed`);
  return { nicheId, scoring, messaging };
});

module.exports = runner;
module.exports.CampaignRunner = CampaignRunner;
module.exports.enqueuePipelineStage = enqueuePipelineStage;
