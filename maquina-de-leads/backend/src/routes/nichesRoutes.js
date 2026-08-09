const express = require('express');
const niches = require('../controllers/nichesController');
const keywords = require('../controllers/keywordsController');
const templates = require('../controllers/messageTemplatesController');
const credentials = require('../controllers/credentialsController');
const agents = require('../controllers/agentsController');
const leads = require('../controllers/leadsController');

const router = express.Router();

// Nichos
router.get('/', niches.list);
router.post('/', niches.create);
router.get('/:id', niches.getOne);
router.put('/:id', niches.update);
router.delete('/:id', niches.remove);

// Palavras-chave
router.get('/:nicheId/keywords', keywords.list);
router.post('/:nicheId/keywords', keywords.bulkCreate);
router.put('/:nicheId/keywords/:id', keywords.update);
router.delete('/:nicheId/keywords/:id', keywords.remove);

// Templates de mensagem
router.get('/:nicheId/templates', templates.list);
router.post('/:nicheId/templates', templates.create);
router.put('/:nicheId/templates/:id', templates.update);
router.delete('/:nicheId/templates/:id', templates.remove);

// Credenciais
router.get('/:nicheId/credentials', credentials.list);
router.put('/:nicheId/credentials', credentials.upsert);

// Agentes n8n
router.get('/:nicheId/agents', agents.list);
router.post('/:nicheId/agents', agents.createOrUpdateAgent);
router.post('/:nicheId/agents/:id/resync', agents.resync);
router.patch('/:nicheId/agents/:id/active', agents.toggleActive);
router.delete('/:nicheId/agents/:id', agents.remove);

// Leads
router.get('/:nicheId/leads', leads.list);
router.get('/:nicheId/leads/stats', leads.stats);

module.exports = router;
