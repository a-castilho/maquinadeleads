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

// Handler mínimo para validar fila, lock, execução e auditoria sem depender
// de integrações externas. Pode ser removido quando os primeiros jobs reais
// de campanha estiverem registrados.
runner.register('system.noop', async ({ payload }) => ({
  ok: true,
  payload,
}));

module.exports = runner;
module.exports.CampaignRunner = CampaignRunner;
