const leadDiscoveryService = require('./leadDiscoveryService');
const messagingService = require('./messagingService');
const enrichmentService = require('./enrichmentService');

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

const runner = new CampaignRunner();

runner.register('system.noop', async ({ payload }) => ({ ok: true, payload }));

runner.register('campaign.discover_leads', async ({ nicheId, payload }) => {
  if (!nicheId) throw new Error('Job de descoberta sem niche_id.');
  return leadDiscoveryService.discover(nicheId, payload);
});

runner.register('campaign.enrich_leads', async ({ nicheId, payload }) => {
  if (!nicheId) throw new Error('Job de enriquecimento sem niche_id.');
  return enrichmentService.enrichBatch(nicheId, payload);
});

runner.register('campaign.send_messages', async ({ nicheId, payload }) => {
  if (!nicheId) throw new Error('Job de envio sem niche_id.');
  return messagingService.sendBatch(nicheId, payload);
});

module.exports = runner;
module.exports.CampaignRunner = CampaignRunner;
