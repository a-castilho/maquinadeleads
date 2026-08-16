function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
}

function calculateCompleteness(profile) {
  const weighted = [
    ['trade_name', 4], ['legal_name', 3], ['cnpj', 4], ['website', 3],
    ['market_segment', 7], ['description', 7], ['products_services', 8],
    ['value_proposition', 7], ['differentiators', 5], ['service_regions', 5],
    ['ideal_customer_profile', 9], ['target_industries', 7], ['target_company_sizes', 5],
    ['target_roles', 6], ['customer_pains', 6], ['purchase_triggers', 5],
    ['disqualifiers', 3], ['keywords_seed', 3], ['negative_keywords', 2], ['average_ticket', 2],
  ];

  let score = 0;
  for (const [key, weight] of weighted) {
    const value = profile[key];
    const filled = Array.isArray(value)
      ? value.length > 0
      : value && typeof value === 'object'
        ? Object.keys(value).length > 0
        : String(value || '').trim().length > 0;
    if (filled) score += weight;
  }
  return Math.min(100, score);
}

function generateKeywords(profile) {
  const seeds = cleanList(profile.keywords_seed);
  const segments = cleanList([profile.market_segment, ...(profile.subsegments || []), ...(profile.target_industries || [])]);
  const offers = cleanList(profile.products_services);
  const regions = cleanList(profile.service_regions);
  const pains = cleanList(profile.customer_pains);
  const roles = cleanList(profile.target_roles);
  const triggers = cleanList(profile.purchase_triggers);
  const sizes = cleanList(profile.target_company_sizes);

  const candidates = new Set(seeds);
  const add = (...parts) => {
    const value = parts.map((p) => String(p || '').trim()).filter(Boolean).join(' ');
    if (value.length >= 3) candidates.add(value);
  };

  segments.forEach((segment) => {
    add(segment);
    regions.forEach((region) => add(segment, region));
    offers.forEach((offer) => add(segment, offer));
    pains.forEach((pain) => add(segment, pain));
    sizes.forEach((size) => add(segment, size));
  });

  offers.forEach((offer) => {
    add(offer);
    regions.forEach((region) => add(offer, region));
    roles.forEach((role) => add(role, offer));
    triggers.forEach((trigger) => add(trigger, offer));
  });

  roles.forEach((role) => segments.forEach((segment) => add(role, segment)));

  return [...candidates].slice(0, 120);
}

function normalizeSyntheticCnpj(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;

  // Perfis de teste antigos usavam o prefixo TESTE-, deixando o valor maior
  // que VARCHAR(18) em instalações anteriores. Removemos somente esse prefixo
  // para manter o identificador sintético compatível mesmo antes da migration
  // que converteu a coluna para TEXT.
  if (/^TESTE-/i.test(raw)) return raw.replace(/^TESTE-/i, '').slice(0, 18);
  return raw;
}

function normalizeProfile(input = {}) {
  const arrayFields = [
    'service_regions', 'subsegments', 'cnaes', 'products_services', 'differentiators',
    'main_competitors', 'target_industries', 'target_company_sizes', 'target_roles',
    'buyer_personas', 'customer_pains', 'purchase_triggers', 'objections', 'disqualifiers',
    'sales_channels', 'keywords_seed', 'negative_keywords',
  ];

  const normalized = { ...input };
  arrayFields.forEach((field) => { normalized[field] = cleanList(input[field]); });
  normalized.cnpj = normalizeSyntheticCnpj(input.cnpj);
  normalized.ideal_customer_profile = input.ideal_customer_profile && typeof input.ideal_customer_profile === 'object'
    ? input.ideal_customer_profile
    : {};
  normalized.generated_keywords = generateKeywords(normalized);
  normalized.profile_completeness = calculateCompleteness(normalized);
  return normalized;
}

module.exports = {
  normalizeProfile,
  generateKeywords,
  calculateCompleteness,
  normalizeSyntheticCnpj,
};
