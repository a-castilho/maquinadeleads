function clean(value) {
  return String(value || '').trim();
}

function titleCase(value) {
  return clean(value)
    .toLowerCase()
    .replace(/(^|\s|[-/])([a-záàâãéèêíïóôõöúç])/g, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function hashtag(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 32);
}

function generateInstagramContent(profile = {}) {
  const companyName = clean(profile.companyName || profile.name) || 'Sua empresa';
  const segment = clean(profile.segment || profile.niche) || 'negócios';
  const city = clean(profile.city || profile.location);
  const audience = clean(profile.audience) || 'pessoas que procuram uma solução confiável';
  const tone = clean(profile.tone) || 'profissional, acolhedor e confiável';
  const offer = clean(profile.offer) || `soluções em ${segment}`;
  const objective = clean(profile.objective) || 'gerar novos contatos e oportunidades';
  const instagram = clean(profile.instagram).replace(/^@/, '');

  const headline = `${titleCase(segment)} que transforma atenção em oportunidade.`;
  const locationText = city ? ` em ${city}` : '';
  const caption = `${companyName} ajuda ${audience}${locationText} com ${offer}. `
    + `A comunicação foi pensada em um tom ${tone}, com foco em ${objective}. `
    + 'Quer saber como funciona? Fale com a equipe e dê o próximo passo.';
  const cta = instagram
    ? `Envie uma mensagem para @${instagram} e saiba mais.`
    : 'Envie uma mensagem e saiba mais.';

  const hashtags = [
    hashtag(companyName),
    hashtag(segment),
    hashtag(city),
    'ConteudoInteligente',
    'GeracaoDeLeads',
    'MarketingDigital',
  ].filter(Boolean).map((item) => `#${item}`);

  const narration = `${headline} ${companyName} oferece ${offer}${locationText}. ${cta}`;
  const imagePrompt = `Imagem vertical 9:16 para Instagram Reels da empresa ${companyName}, segmento ${segment}, `
    + `público ${audience}, estética premium, limpa e moderna, comunicação ${tone}, sem texto pequeno, `
    + `espaço negativo para headline, foco comercial e aparência autêntica.`;

  return {
    headline,
    caption,
    cta,
    hashtags,
    narration,
    imagePrompt,
    format: 'reel',
    aspectRatio: '9:16',
    durationSeconds: 15,
    generatedAt: new Date().toISOString(),
  };
}

function getInstagramCapabilities() {
  const accountConfigured = Boolean(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID);
  const tokenConfigured = Boolean(process.env.INSTAGRAM_ACCESS_TOKEN);
  const mediaBaseUrlConfigured = Boolean(process.env.PUBLIC_MEDIA_BASE_URL);

  return {
    contentGeneration: true,
    narrationPreview: true,
    imagePromptGeneration: true,
    publishConfigured: accountConfigured && tokenConfigured && mediaBaseUrlConfigured,
    requirements: {
      instagramBusinessAccountId: accountConfigured,
      instagramAccessToken: tokenConfigured,
      publicMediaBaseUrl: mediaBaseUrlConfigured,
    },
  };
}

module.exports = { generateInstagramContent, getInstagramCapabilities };
