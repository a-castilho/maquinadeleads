const test = require('node:test');
const assert = require('node:assert/strict');

const { computeScore } = require('../src/services/leadScoringService');
const {
  normalizeBrazilianPhone,
  renderMessage,
  classifyFailure,
} = require('../src/services/messagingService');
const {
  buildQueries,
  cleanProfileName,
  toLead,
} = require('../src/services/leadDiscoveryService');
const { extractEmail, extractPhone } = require('../src/services/enrichmentService');
const campaignRunner = require('../src/services/campaignRunner');
const resilientDiscovery = require('../src/services/resilientLeadDiscoveryService');
const enrichmentService = require('../src/services/enrichmentService');
const leadScoringService = require('../src/services/leadScoringService');
const jobService = require('../src/services/jobService');

test('computeScore reaches 100 for a strongly qualified lead', () => {
  const result = computeScore({
    campaign: { location: 'São Paulo - SP' },
    keywords: [{ kind: 'nicho', term: 'dentista' }],
    lead: {
      nome_perfil: 'Clínica Sorriso', whatsapp: '5511999999999', email: 'contato@clinicasorriso.com.br',
      enrichment_status: 'enriquecido', descricao_extra: 'Dentista e implantes em São Paulo',
      snippet: 'Clínica odontológica em São Paulo', original_query: 'dentista whatsapp', fonte_url: 'https://clinicasorriso.com.br',
    },
  });
  assert.equal(result.score, 100);
  assert.ok(result.breakdown.length >= 6);
});

test('computeScore keeps a low-information lead below qualification range', () => {
  const result = computeScore({
    campaign: { location: 'Curitiba' },
    keywords: [{ kind: 'nicho', term: 'academia' }],
    lead: { nome_perfil: 'Desconhecido', whatsapp: null, email: null, enrichment_status: 'sem_dados', descricao_extra: null, snippet: 'conteúdo genérico', original_query: 'outra busca', fonte_url: '' },
  });
  assert.equal(result.score, 0);
});

test('normalizeBrazilianPhone accepts Brazilian mobile formats', () => {
  assert.equal(normalizeBrazilianPhone('(11) 99999-9999'), '5511999999999');
  assert.equal(normalizeBrazilianPhone('5511999999999'), '5511999999999');
});

test('normalizeBrazilianPhone inserts ninth digit for legacy 10 digit number', () => {
  assert.equal(normalizeBrazilianPhone('1133334444'), '5511933334444');
});

test('renderMessage replaces supported name placeholders', () => {
  assert.equal(renderMessage('Olá {{nome}}, {nome} e [NOME]!', 'Maria Silva'), 'Olá Maria, Maria e Maria!');
});

test('classifyFailure allows explicit 4xx to be marked failed', () => {
  const result = classifyFailure({ response: { status: 400 } });
  assert.equal(result.status, 400);
  assert.equal(result.outboxStatus, 'failed');
});

test('classifyFailure treats timeout or 5xx as unknown to avoid duplicate resend', () => {
  assert.equal(classifyFailure(new Error('timeout')).outboxStatus, 'unknown');
  assert.equal(classifyFailure({ response: { status: 503 } }).outboxStatus, 'unknown');
});

test('buildQueries mixes broad, local, contact and social discovery', () => {
  const queries = buildQueries(['odontologia'], ['contato'], 20, 'Paraguaçu MG');
  assert.ok(queries.some((q) => q.includes('"odontologia" Paraguaçu MG')));
  assert.ok(queries.some((q) => q.includes('empresa Paraguaçu MG')));
  assert.ok(queries.some((q) => q.includes('telefone Paraguaçu MG')));
  assert.ok(queries.some((q) => q.includes('site:instagram.com')));
});

test('cleanProfileName keeps useful names even when search title is long', () => {
  const title = 'Clínica Odontológica Sorriso Perfeito - Implantes, Ortodontia e Atendimento em São Paulo';
  assert.equal(cleanProfileName(title), 'Clínica Odontológica Sorriso Perfeito');
});

test('toLead accepts identifiable business without phone for later enrichment', () => {
  const converted = toLead({ title: 'Clínica Sorriso | Odontologia', link: 'https://clinicasorriso.com.br', snippet: 'Atendimento odontológico em Belo Horizonte', query: 'odontologia Belo Horizonte' }, '00000000-0000-0000-0000-000000000001');
  assert.ok(converted.lead);
  assert.equal(converted.lead.nomePerfil, 'Clínica Sorriso');
  assert.equal(converted.lead.status, 'sem_telefone');
});

test('enrichment extracts email and Brazilian phone from page content', () => {
  const html = '<p>Contato: comercial@empresa.com.br | (31) 99999-1234</p>';
  assert.equal(extractEmail(html), 'comercial@empresa.com.br');
  assert.equal(extractPhone(html), '5531999991234');
});

test('native runner wires the full operational pipeline', () => {
  assert.equal(campaignRunner.has('campaign.discover_leads'), true);
  assert.equal(campaignRunner.has('campaign.enrich_leads'), true);
  assert.equal(campaignRunner.has('campaign.score_leads'), true);
  assert.equal(campaignRunner.has('campaign.process_batch'), true);
  assert.equal(campaignRunner.has('campaign.send_messages'), true);
  assert.equal(typeof jobService.enqueueUnique, 'function');
  assert.equal(typeof jobService.isProcessing, 'function');
});

test('automatic preparation chains discovery to enrichment and scoring', async () => {
  const originalDiscover = resilientDiscovery.discover;
  const originalEnrich = enrichmentService.enrichBatch;
  const originalScore = leadScoringService.scoreBatch;
  const originalEnqueueUnique = jobService.enqueueUnique;
  const enqueued = [];
  resilientDiscovery.discover = async () => ({ rawResults: 4, candidates: 3, inserted: 3 });
  enrichmentService.enrichBatch = async () => ({ processed: 3, enriched: 2 });
  leadScoringService.scoreBatch = async () => ({ processed: 3, qualified: 2 });
  jobService.enqueueUnique = async (input) => { enqueued.push(input); return { id: `job-${enqueued.length}`, ...input }; };
  try {
    const discovery = await campaignRunner.run({ job_type: 'campaign.discover_leads', niche_id: 'niche-1', payload: { autoPipeline: true, enrichBatchSize: 25, scoreBatchSize: 500 } });
    assert.equal(discovery.pipeline, true);
    assert.equal(enqueued[0].jobType, 'campaign.enrich_leads');
    const enrichment = await campaignRunner.run({ job_type: 'campaign.enrich_leads', niche_id: 'niche-1', payload: { autoPipeline: true, scoreBatchSize: 500 } });
    assert.equal(enrichment.pipeline, true);
    assert.equal(enqueued[1].jobType, 'campaign.score_leads');
    const scoring = await campaignRunner.run({ job_type: 'campaign.score_leads', niche_id: 'niche-1', payload: { autoPipeline: true, force: true } });
    assert.equal(scoring.preparationCompleted, true);
  } finally {
    resilientDiscovery.discover = originalDiscover;
    enrichmentService.enrichBatch = originalEnrich;
    leadScoringService.scoreBatch = originalScore;
    jobService.enqueueUnique = originalEnqueueUnique;
  }
});

test('cancelled discovery does not chain into enrichment after manual restart', async () => {
  const originalDiscover = resilientDiscovery.discover;
  const originalIsProcessing = jobService.isProcessing;
  const originalEnqueueUnique = jobService.enqueueUnique;
  let enqueued = 0;
  resilientDiscovery.discover = async () => ({ rawResults: 2, candidates: 2, inserted: 2 });
  jobService.isProcessing = async () => false;
  jobService.enqueueUnique = async () => { enqueued += 1; return { id: 'unexpected' }; };
  try {
    const result = await campaignRunner.run({
      id: 'cancelled-job',
      job_type: 'campaign.discover_leads',
      niche_id: 'niche-1',
      payload: { autoPipeline: true },
    });
    assert.equal(result.pipelineCancelled, true);
    assert.equal(result.nextJobId, null);
    assert.equal(enqueued, 0);
  } finally {
    resilientDiscovery.discover = originalDiscover;
    jobService.isProcessing = originalIsProcessing;
    jobService.enqueueUnique = originalEnqueueUnique;
  }
});
