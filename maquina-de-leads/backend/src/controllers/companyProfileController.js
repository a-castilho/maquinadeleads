const db = require('../config/db');
const { normalizeProfile } = require('../services/companyProfileService');

const FIELDS = [
  'legal_name','trade_name','cnpj','website','linkedin_url','instagram_url','phone','email',
  'headquarters_city','headquarters_state','service_regions','company_size','employee_range',
  'annual_revenue_range','founding_year','business_model','market_segment','subsegments','cnaes',
  'description','products_services','value_proposition','differentiators','main_competitors',
  'ideal_customer_profile','target_industries','target_company_sizes','target_roles','buyer_personas',
  'customer_pains','purchase_triggers','objections','disqualifiers','average_ticket','sales_cycle',
  'sales_channels','keywords_seed','negative_keywords','generated_keywords','search_notes','profile_completeness'
];

const JSON_FIELDS = new Set([
  'service_regions','subsegments','cnaes','products_services','differentiators','main_competitors',
  'ideal_customer_profile','target_industries','target_company_sizes','target_roles','buyer_personas',
  'customer_pains','purchase_triggers','objections','disqualifiers','sales_channels','keywords_seed',
  'negative_keywords','generated_keywords',
]);

const TEST_PROFILES = [
  {
    legal_name: 'Nuvem Forte Tecnologia Ltda. - EMPRESA FICTÍCIA',
    trade_name: 'Nuvem Forte',
    cnpj: 'TESTE-01.000.000/0001-01',
    website: 'https://nuvemforte.example.com',
    linkedin_url: 'https://linkedin.com/company/nuvemforte-teste',
    instagram_url: 'https://instagram.com/nuvemforte_teste',
    phone: '+55 11 90000-0001', email: 'comercial@nuvemforte.example.com',
    headquarters_city: 'São Paulo', headquarters_state: 'SP', service_regions: ['São Paulo', 'Minas Gerais', 'Brasil'],
    company_size: 'Pequena empresa', employee_range: '20-50', annual_revenue_range: 'R$ 2 mi - R$ 8 mi', founding_year: '2019',
    business_model: 'B2B SaaS', market_segment: 'Tecnologia', subsegments: ['SaaS', 'Automação comercial', 'CRM'], cnaes: ['6201-5/01', '6204-0/00'],
    description: 'Empresa fictícia de software B2B que oferece automação de vendas, CRM e inteligência comercial para pequenas e médias empresas.',
    products_services: ['CRM para PMEs', 'Automação de vendas', 'Gestão de pipeline', 'Relatórios comerciais'],
    value_proposition: 'Reduzir trabalho manual do time comercial e aumentar previsibilidade de vendas com automação simples e rápida de implantar.',
    differentiators: ['Implantação em até 7 dias', 'Suporte consultivo', 'Integração via API', 'Painéis prontos para gestores'],
    main_competitors: ['CRM genérico', 'Planilhas', 'Ferramentas internacionais de vendas'],
    average_ticket: 'R$ 1.500/mês', sales_cycle: '15-30 dias', sales_channels: ['Inside sales', 'WhatsApp', 'LinkedIn', 'Indicação'],
    ideal_customer_profile: { description: 'PMEs B2B com equipe comercial de 5 a 30 vendedores e processo ainda dependente de planilhas.', min_employees: '15', max_employees: '200', min_revenue: 'R$ 1 mi', max_revenue: 'R$ 80 mi' },
    target_industries: ['Tecnologia', 'Serviços empresariais', 'Consultorias', 'Distribuidores'], target_company_sizes: ['Pequena', 'Média'],
    target_roles: ['Diretor Comercial', 'Gerente de Vendas', 'CEO', 'Head de Growth'], buyer_personas: ['Gestor comercial orientado a metas', 'Fundador que lidera vendas'],
    customer_pains: ['Leads perdidos em planilhas', 'Baixa previsibilidade de vendas', 'Follow-up manual', 'Falta de visão do funil'],
    purchase_triggers: ['Contratação de vendedores', 'Crescimento do volume de leads', 'Troca de CRM', 'Meta comercial não atingida'],
    objections: ['Equipe não vai usar', 'Já usamos planilha', 'Preço'], disqualifiers: ['Empresa sem equipe comercial', 'B2C de baixo ticket'],
    keywords_seed: ['empresa com equipe comercial', 'CRM para PME', 'automação de vendas B2B'], negative_keywords: ['curso', 'emprego', 'grátis'],
    search_notes: 'PERFIL SINTÉTICO PARA TESTES. Priorizar empresas B2B em crescimento com sinais de estrutura comercial.'
  },
  {
    legal_name: 'Clínica Horizonte Saúde Integrada Ltda. - EMPRESA FICTÍCIA', trade_name: 'Clínica Horizonte', cnpj: 'TESTE-02.000.000/0001-02',
    website: 'https://clinicahorizonte.example.com', linkedin_url: 'https://linkedin.com/company/clinica-horizonte-teste', instagram_url: 'https://instagram.com/clinicahorizonte_teste',
    phone: '+55 31 90000-0002', email: 'contato@clinicahorizonte.example.com', headquarters_city: 'Belo Horizonte', headquarters_state: 'MG', service_regions: ['Belo Horizonte', 'Região Metropolitana de BH'],
    company_size: 'Média empresa', employee_range: '50-120', annual_revenue_range: 'R$ 8 mi - R$ 25 mi', founding_year: '2016', business_model: 'B2C e B2B',
    market_segment: 'Saúde', subsegments: ['Clínica médica', 'Medicina ocupacional', 'Telemedicina'], cnaes: ['8630-5/03'],
    description: 'Clínica fictícia multiprofissional com atendimento particular, corporativo e programas de saúde ocupacional.',
    products_services: ['Consultas médicas', 'Exames ocupacionais', 'PCMSO', 'Telemedicina corporativa'], value_proposition: 'Centralizar saúde assistencial e ocupacional de empresas com atendimento ágil e indicadores de gestão.',
    differentiators: ['Agenda rápida', 'Atendimento corporativo', 'Dashboard para RH', 'Telemedicina'], main_competitors: ['Clínicas ocupacionais locais', 'Redes de medicina diagnóstica'],
    average_ticket: 'R$ 8.000/mês por contrato corporativo', sales_cycle: '30-60 dias', sales_channels: ['Vendas consultivas', 'Parcerias', 'WhatsApp', 'Indicação'],
    ideal_customer_profile: { description: 'Empresas com 80 a 1000 colaboradores que precisam reduzir absenteísmo e organizar saúde ocupacional.', min_employees: '80', max_employees: '1000', min_revenue: 'R$ 10 mi', max_revenue: 'R$ 500 mi' },
    target_industries: ['Indústria', 'Logística', 'Construção civil', 'Serviços'], target_company_sizes: ['Média', 'Grande'], target_roles: ['Gerente de RH', 'Diretor de RH', 'SESMT', 'Departamento Pessoal'],
    buyer_personas: ['Gestor de RH responsável por benefícios e saúde', 'Responsável por segurança do trabalho'], customer_pains: ['Absenteísmo alto', 'Exames atrasados', 'Múltiplos fornecedores', 'Falta de indicadores de saúde'],
    purchase_triggers: ['Auditoria trabalhista', 'Crescimento do quadro', 'Troca de fornecedor ocupacional', 'Aumento de afastamentos'], objections: ['Contrato vigente', 'Preço por colaborador'],
    disqualifiers: ['Microempresa sem funcionários'], keywords_seed: ['empresa contratando funcionários', 'medicina ocupacional empresas', 'RH saúde ocupacional'], negative_keywords: ['vaga médico', 'curso medicina', 'SUS'],
    search_notes: 'PERFIL SINTÉTICO PARA TESTES. Buscar empresas com quadro relevante de funcionários e sinais de crescimento.'
  },
  {
    legal_name: 'EcoFlux Energia e Eficiência Ltda. - EMPRESA FICTÍCIA', trade_name: 'EcoFlux', cnpj: 'TESTE-03.000.000/0001-03', website: 'https://ecoflux.example.com',
    linkedin_url: 'https://linkedin.com/company/ecoflux-teste', instagram_url: 'https://instagram.com/ecoflux_teste', phone: '+55 19 90000-0003', email: 'vendas@ecoflux.example.com',
    headquarters_city: 'Campinas', headquarters_state: 'SP', service_regions: ['Sudeste', 'Sul'], company_size: 'Pequena empresa', employee_range: '15-40', annual_revenue_range: 'R$ 3 mi - R$ 12 mi', founding_year: '2020',
    business_model: 'B2B serviços e projetos', market_segment: 'Energia', subsegments: ['Energia solar', 'Eficiência energética', 'Gestão de consumo'], cnaes: ['4321-5/00', '7112-0/00'],
    description: 'Empresa fictícia de engenharia especializada em redução de custos de energia para operações comerciais e industriais.', products_services: ['Projeto solar fotovoltaico', 'Diagnóstico energético', 'Gestão de demanda', 'Monitoramento de consumo'],
    value_proposition: 'Reduzir custo energético com projetos de retorno mensurável e acompanhamento contínuo.', differentiators: ['Diagnóstico financeiro antes da venda', 'Projeto turnkey', 'Monitoramento pós-implantação'],
    main_competitors: ['Integradores solares regionais', 'Consultorias de energia'], average_ticket: 'R$ 120 mil por projeto', sales_cycle: '45-90 dias', sales_channels: ['Prospecção outbound', 'Parceiros', 'Eventos setoriais'],
    ideal_customer_profile: { description: 'Empresas com unidades físicas, consumo energético relevante e conta mensal acima de R$ 20 mil.', min_employees: '30', max_employees: '2000', min_revenue: 'R$ 5 mi', max_revenue: 'R$ 1 bi' },
    target_industries: ['Indústria', 'Supermercados', 'Hotéis', 'Centros logísticos', 'Agronegócio'], target_company_sizes: ['Média', 'Grande'], target_roles: ['Diretor Industrial', 'Facilities', 'Diretor Financeiro', 'CEO'],
    buyer_personas: ['Gestor pressionado por redução de custos', 'Diretor financeiro buscando payback'], customer_pains: ['Conta de energia alta', 'Demanda contratada inadequada', 'Metas ESG', 'Margem pressionada'],
    purchase_triggers: ['Aumento da tarifa de energia', 'Expansão de unidade', 'Meta ESG', 'Novo galpão ou fábrica'], objections: ['CAPEX alto', 'Payback longo', 'Obra interfere na operação'],
    disqualifiers: ['Baixo consumo de energia', 'Imóvel sem autonomia para investimento'], keywords_seed: ['indústria alto consumo energia', 'empresa energia solar', 'redução conta energia empresa'], negative_keywords: ['residencial', 'kit solar casa', 'curso'],
    search_notes: 'PERFIL SINTÉTICO PARA TESTES. Priorizar operações intensivas em energia e empresas com múltiplas unidades.'
  },
  {
    legal_name: 'Rota Certa Logística Inteligente Ltda. - EMPRESA FICTÍCIA', trade_name: 'Rota Certa', cnpj: 'TESTE-04.000.000/0001-04', website: 'https://rotacerta.example.com',
    linkedin_url: 'https://linkedin.com/company/rota-certa-teste', instagram_url: 'https://instagram.com/rotacerta_teste', phone: '+55 41 90000-0004', email: 'negocios@rotacerta.example.com', headquarters_city: 'Curitiba', headquarters_state: 'PR',
    service_regions: ['Paraná', 'Santa Catarina', 'São Paulo'], company_size: 'Média empresa', employee_range: '80-250', annual_revenue_range: 'R$ 20 mi - R$ 80 mi', founding_year: '2014', business_model: 'B2B',
    market_segment: 'Logística', subsegments: ['Transporte rodoviário', 'Last mile', 'Armazenagem'], cnaes: ['4930-2/02', '5211-7/01'], description: 'Operador logístico fictício para indústrias e e-commerces com transporte, armazenagem e rastreamento.',
    products_services: ['Transporte fracionado', 'Carga dedicada', 'Armazenagem', 'Last mile'], value_proposition: 'Reduzir atrasos e dar visibilidade ponta a ponta da operação logística.', differentiators: ['Rastreamento em tempo real', 'SLA contratual', 'Torre de controle'],
    main_competitors: ['Transportadoras regionais', 'Operadores logísticos nacionais'], average_ticket: 'R$ 35 mil/mês', sales_cycle: '45-120 dias', sales_channels: ['Executivos de contas', 'Outbound', 'RFP'],
    ideal_customer_profile: { description: 'Indústrias, distribuidores e e-commerces com alto volume mensal de expedição no Sul e Sudeste.', min_employees: '50', max_employees: '5000', min_revenue: 'R$ 20 mi', max_revenue: 'R$ 5 bi' },
    target_industries: ['Indústria', 'E-commerce', 'Distribuição', 'Autopeças'], target_company_sizes: ['Média', 'Grande'], target_roles: ['Gerente de Logística', 'Supply Chain', 'Diretor de Operações', 'Compras'],
    buyer_personas: ['Gestor de logística com SLA crítico', 'Diretor de operações buscando redução de custo'], customer_pains: ['Atrasos de entrega', 'Frete caro', 'Baixa rastreabilidade', 'Avarias'], purchase_triggers: ['Expansão regional', 'Novo centro de distribuição', 'Problemas com transportadora atual', 'Pico de pedidos'],
    objections: ['Contrato atual', 'Cobertura geográfica', 'Integração com ERP'], disqualifiers: ['Baixo volume de embarques'], keywords_seed: ['empresa com centro de distribuição', 'indústria logística transporte', 'ecommerce alto volume entregas'], negative_keywords: ['mudança residencial', 'motoboy emprego'],
    search_notes: 'PERFIL SINTÉTICO PARA TESTES. Buscar empresas com sinais de operação logística complexa e volume recorrente.'
  }
];

function serializeField(field, value) {
  if (value == null) return null;
  if (JSON_FIELDS.has(field)) return JSON.stringify(value);
  return value;
}

function buildProfileValues(rawProfile) {
  const profile = normalizeProfile(rawProfile || {});
  return {
    profile,
    values: FIELDS.map((field) => serializeField(field, profile[field] ?? null)),
  };
}

async function persistProfile(userId, rawProfile) {
  const { values } = buildProfileValues(rawProfile);
  const columns = FIELDS.join(', ');
  const placeholders = FIELDS.map((_, i) => `$${i + 2}`).join(', ');
  const updates = FIELDS.map((field) => `${field} = EXCLUDED.${field}`).join(', ');
  const sql = `INSERT INTO company_profiles (user_id, ${columns}) VALUES ($1, ${placeholders}) ON CONFLICT (user_id) DO UPDATE SET ${updates}, updated_at = NOW() RETURNING *`;
  const { rows } = await db.query(sql, [userId, ...values]);
  return rows[0];
}

async function getProfile(req, res, next) {
  try {
    const { rows } = await db.query('SELECT * FROM company_profiles WHERE user_id = $1', [req.user.id]);
    return res.json(rows[0] || null);
  } catch (err) {
    console.error(`[company-profile] GET user=${req.user?.id || 'unknown'}:`, err.message);
    return next(err);
  }
}

async function upsertProfile(req, res, next) {
  try {
    const saved = await persistProfile(req.user.id, req.body || {});
    console.log(`[company-profile] saved user=${req.user.id} completeness=${saved.profile_completeness}`);
    return res.json(saved);
  } catch (err) {
    console.error(`[company-profile] SAVE user=${req.user?.id || 'unknown'}:`, err.message);
    return next(err);
  }
}

async function regenerateKeywords(req, res, next) {
  try {
    const current = await db.query('SELECT * FROM company_profiles WHERE user_id = $1', [req.user.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Perfil empresarial ainda não criado.' });
    const profile = normalizeProfile(current.rows[0]);
    const { rows } = await db.query(
      'UPDATE company_profiles SET generated_keywords = $2::jsonb, profile_completeness = $3, updated_at = NOW() WHERE user_id = $1 RETURNING *',
      [req.user.id, JSON.stringify(profile.generated_keywords), profile.profile_completeness]
    );
    console.log(`[company-profile] keywords regenerated user=${req.user.id} count=${profile.generated_keywords.length}`);
    return res.json(rows[0]);
  } catch (err) {
    console.error(`[company-profile] KEYWORDS user=${req.user?.id || 'unknown'}:`, err.message);
    return next(err);
  }
}

async function generateTestProfile(req, res, next) {
  try {
    const requestedIndex = Number(req.body?.index);
    const index = Number.isInteger(requestedIndex) && requestedIndex >= 0
      ? requestedIndex % TEST_PROFILES.length
      : Math.floor(Math.random() * TEST_PROFILES.length);
    const seed = { ...TEST_PROFILES[index], test_profile: true };
    const saved = await persistProfile(req.user.id, seed);
    console.log(`[company-profile] test generated user=${req.user.id} index=${index} name=${saved.trade_name} completeness=${saved.profile_completeness}`);
    return res.status(201).json({ ...saved, test_profile: true, test_profile_index: index, available_test_profiles: TEST_PROFILES.length });
  } catch (err) {
    console.error(`[company-profile] GENERATE_TEST user=${req.user?.id || 'unknown'}:`, err.message);
    return next(err);
  }
}

module.exports = {
  getProfile,
  upsertProfile,
  regenerateKeywords,
  generateTestProfile,
  serializeField,
  buildProfileValues,
  TEST_PROFILES,
};
