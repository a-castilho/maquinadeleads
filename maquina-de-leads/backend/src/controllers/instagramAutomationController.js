const {
  generateInstagramContent,
  getInstagramCapabilities,
} = require('../services/instagramAutomationService');

function validateProfile(profile = {}) {
  const missing = [];
  if (!String(profile.companyName || profile.name || '').trim()) missing.push('companyName');
  if (!String(profile.segment || profile.niche || '').trim()) missing.push('segment');
  return missing;
}

function capabilities(req, res) {
  res.json({ capabilities: getInstagramCapabilities() });
}

function generate(req, res) {
  const profile = req.body?.profile || req.body || {};
  const missing = validateProfile(profile);
  if (missing.length) {
    return res.status(400).json({
      error: 'Preencha os dados mínimos da empresa.',
      missing,
    });
  }

  return res.json({
    content: generateInstagramContent(profile),
    capabilities: getInstagramCapabilities(),
  });
}

function publish(req, res) {
  const profile = req.body?.profile || {};
  const content = req.body?.content || {};
  const scheduleAt = req.body?.scheduleAt || null;
  const capabilitiesInfo = getInstagramCapabilities();
  const missing = validateProfile(profile);

  if (missing.length) {
    return res.status(400).json({ error: 'Cadastro da empresa incompleto.', missing });
  }
  if (!content.headline || !content.caption || !content.narration) {
    return res.status(400).json({ error: 'Gere o conteúdo antes de publicar.' });
  }

  if (!capabilitiesInfo.publishConfigured) {
    return res.status(409).json({
      error: 'Integração oficial do Instagram ainda não configurada no servidor.',
      code: 'INSTAGRAM_INTEGRATION_REQUIRED',
      capabilities: capabilitiesInfo,
      draft: {
        status: 'ready_for_integration',
        scheduleAt,
        instagram: profile.instagram || null,
        format: content.format || 'reel',
      },
    });
  }

  return res.status(202).json({
    ok: true,
    publication: {
      status: scheduleAt ? 'scheduled' : 'queued',
      scheduleAt,
      instagram: profile.instagram || null,
      format: content.format || 'reel',
      createdAt: new Date().toISOString(),
    },
    note: 'Credenciais detectadas. O transporte de mídia deve ser executado pelo adaptador oficial da Meta antes da publicação final.',
  });
}

module.exports = { capabilities, generate, publish };
