const express = require('express');
const rateLimit = require('express-rate-limit');
const { searchWithGpt } = require('../controllers/leadDiscoveryController');

const router = express.Router();

const gptSearchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas buscas em pouco tempo. Tente novamente em alguns minutos.' },
});

router.post('/gpt-search', gptSearchLimiter, searchWithGpt);

module.exports = router;
