const leadDiscoveryService = require('./leadDiscoveryService');

function validateDiscoveryResult(result, nicheId = 'unknown') {
  if (Number(result?.rawResults || 0) === 0) {
    const message = [
      'Nenhum provedor retornou resultados para a descoberta.',
      `queries=${result?.queries || 0}`,
      `providerErrors=${result?.providerErrors || 0}`,
      'Verifique os logs [discovery] e a conectividade do SearXNG/Serper.',
    ].join(' ');

    console.error(`[discovery] zero-results niche=${nicheId} ${message}`);
    const error = new Error(message);
    error.code = 'DISCOVERY_ZERO_RESULTS';
    error.discoveryResult = result;
    throw error;
  }

  if (Number(result?.candidates || 0) === 0) {
    console.warn(
      `[discovery] resultados encontrados mas nenhum candidato aceito niche=${nicheId} ` +
      `raw=${result?.rawResults || 0} rejected=${JSON.stringify(result?.rejected || {})}`
    );
  }

  return result;
}

async function discover(nicheId, options = {}) {
  const result = await leadDiscoveryService.discover(nicheId, options);
  return validateDiscoveryResult(result, nicheId);
}

module.exports = {
  discover,
  validateDiscoveryResult,
};
