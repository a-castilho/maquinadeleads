const { discoverLeadsWithGpt } = require('../services/gptLeadDiscoveryService');

async function searchWithGpt(req, res, next) {
  try {
    const result = await discoverLeadsWithGpt({
      segment: req.body?.segment,
      location: req.body?.location,
      offer: req.body?.offer,
      objective: req.body?.objective,
      quantity: req.body?.quantity,
    });

    return res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        code: error.code || 'LEAD_DISCOVERY_FAILED',
      });
    }
    return next(error);
  }
}

module.exports = {
  searchWithGpt,
};
