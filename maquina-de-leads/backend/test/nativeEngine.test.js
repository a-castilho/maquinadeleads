const test = require('node:test');
const assert = require('node:assert/strict');

const { computeScore } = require('../src/services/leadScoringService');
const {
  normalizeBrazilianPhone,
  renderMessage,
  classifyFailure,
} = require('../src/services/messagingService');

test('computeScore reaches 100 for a strongly qualified lead', () => {
  const result = computeScore({
    campaign: { location: 'São Paulo - SP' },
    keywords: [{ kind: 'nicho', term: 'dentista' }],
    lead: {
      nome_perfil: 'Clínica Sorriso',
      whatsapp: '5511999999999',
      email: 'contato@clinicasorriso.com.br',
      enrichment_status: 'enriquecido',
      descricao_extra: 'Dentista e implantes em São Paulo',
      snippet: 'Clínica odontológica em São Paulo',
      original_query: 'dentista whatsapp site:instagram.com',
      fonte_url: 'https://instagram.com/clinicasorriso',
    },
  });

  assert.equal(result.score, 100);
  assert.ok(result.breakdown.length >= 6);
});

test('computeScore keeps a low-information lead below qualification range', () => {
  const result = computeScore({
    campaign: { location: 'Curitiba' },
    keywords: [{ kind: 'nicho', term: 'academia' }],
    lead: {
      nome_perfil: 'Desconhecido',
      whatsapp: null,
      email: null,
      enrichment_status: 'sem_dados',
      descricao_extra: null,
      snippet: 'conteúdo genérico',
      original_query: 'outra busca',
      fonte_url: 'https://example.com/perfil',
    },
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
  assert.equal(
    renderMessage('Olá {{nome}}, {nome} e [NOME]!', 'Maria Silva'),
    'Olá Maria, Maria e Maria!'
  );
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
