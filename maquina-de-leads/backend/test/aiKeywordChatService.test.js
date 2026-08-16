const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSpecialistPrompt,
  fallbackReply,
  parseChatPayload,
} = require('../src/services/aiKeywordChatService');

const profile = {
  trade_name: 'Empresa Teste',
  market_segment: 'Odontologia',
  subsegments: ['Clínicas odontológicas'],
  products_services: ['Implantes'],
  service_regions: ['Minas Gerais'],
  target_roles: ['Sócio', 'Administrador'],
  customer_pains: ['Baixa ocupação da agenda'],
  purchase_triggers: ['Expansão da clínica'],
  negative_keywords: ['curso', 'emprego'],
  ideal_customer_profile: { description: 'Clínicas com operação própria' },
};

const campaign = {
  name: 'Odontologia MG',
  description: 'Buscar clínicas odontológicas',
  location: 'Minas Gerais',
  offer: 'Consultoria',
  objective: 'Encontrar empresas com telefone e WhatsApp',
};

test('buildSpecialistPrompt contains company profile, campaign and conversation', () => {
  const prompt = buildSpecialistPrompt({
    profile,
    campaign,
    history: [{ role: 'user', content: 'Priorize clínicas maiores' }],
    message: 'Quero encontrar WhatsApp e CNPJ',
    config: { country: 'Brasil', language: 'pt-BR', specialistInstruction: 'Evite consumidor final.' },
  });

  assert.match(prompt, /especialista sênior/i);
  assert.match(prompt, /Odontologia/);
  assert.match(prompt, /Minas Gerais/);
  assert.match(prompt, /WhatsApp e CNPJ/);
  assert.match(prompt, /Evite consumidor final/);
});

test('fallbackReply returns principal, context and negative suggestions', () => {
  const reply = fallbackReply({ profile, campaign, message: 'Quero telefone e whatsapp' });
  assert.equal(reply.fallback, true);
  assert.ok(reply.principal.length > 0);
  assert.ok(reply.contexto.some((item) => /whatsapp/i.test(item)));
  assert.deepEqual(reply.negativas, ['curso', 'emprego']);
});

test('parseChatPayload normalizes structured specialist response', () => {
  const parsed = parseChatPayload(JSON.stringify({
    answer: 'Estratégia refinada.',
    principal: ['clínica odontológica', 'clínica odontológica', 'implantes'],
    contexto: ['whatsapp', 'cnpj'],
    negativas: ['curso'],
  }));

  assert.equal(parsed.answer, 'Estratégia refinada.');
  assert.deepEqual(parsed.principal, ['clínica odontológica', 'implantes']);
  assert.deepEqual(parsed.contexto, ['whatsapp', 'cnpj']);
  assert.deepEqual(parsed.negativas, ['curso']);
});
