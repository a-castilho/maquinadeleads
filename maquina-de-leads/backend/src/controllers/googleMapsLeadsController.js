const { assertNicheOwnership } = require('../utils/ownership');
const googleMapsLeadService = require('../services/googleMapsLeadService');

async function search(req, res) {
  const { nicheId } = req.params;
  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }

    const result = await googleMapsLeadService.searchPlaces(nicheId, {
      sector: req.body?.sector,
      location: req.body?.location,
      extraTerm: req.body?.extraTerm,
      pageSize: req.body?.pageSize,
      pageToken: req.body?.pageToken,
      area: {
        mode: req.body?.area?.mode,
        latitude: req.body?.area?.latitude,
        longitude: req.body?.area?.longitude,
        radiusKm: req.body?.area?.radiusKm,
      },
      filters: {
        requirePhone: Boolean(req.body?.filters?.requirePhone),
        requireWebsite: Boolean(req.body?.filters?.requireWebsite),
        requireWhatsapp: Boolean(req.body?.filters?.requireWhatsapp),
        minRating: req.body?.filters?.minRating,
        minReviews: req.body?.filters?.minReviews,
        operationalOnly: req.body?.filters?.operationalOnly !== false,
      },
    });
    return res.json(result);
  } catch (err) {
    const status = /Configure a chave|obrigat[oó]ri|inválid|raio/i.test(err.message) ? 400 : 502;
    console.error(`[google-maps.controller] search error niche=${nicheId} status=${status} error=${err.message}`);
    return res.status(status).json({ error: err.response?.data?.error?.message || err.message || 'Erro ao buscar no Google Maps.' });
  }
}

async function importLeads(req, res) {
  const { nicheId } = req.params;
  try {
    if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    const places = Array.isArray(req.body?.places) ? req.body.places.slice(0, 100) : [];
    if (!places.length) return res.status(400).json({ error: 'Selecione ao menos um lead para importar.' });
    const result = await googleMapsLeadService.importPlaces(nicheId, places, req.body?.query || '');
    return res.status(201).json(result);
  } catch (err) {
    console.error(`[google-maps.controller] import error niche=${nicheId} error=${err.message}`);
    return res.status(500).json({ error: 'Erro ao importar leads do Google Maps.' });
  }
}

module.exports = { search, importLeads };
