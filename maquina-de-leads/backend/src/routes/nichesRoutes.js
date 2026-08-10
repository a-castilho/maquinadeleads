const express = require('express');

const controllers = {
  niches: require('../controllers/nichesController'),
  keywords: require('../controllers/keywordsController'),
  templates: require('../controllers/messageTemplatesController'),
  credentials: require('../controllers/credentialsController'),
  agents: require('../controllers/agentsController'),
  leads: require('../controllers/leadsController'),
};

// Verifica TODAS as funcoes
const requiredMethods = {
  niches: ['list', 'create', 'getOne', 'update', 'remove'],
  keywords: ['list', 'bulkCreate', 'update', 'remove'],
  templates: ['list', 'create', 'update', 'remove'],
  credentials: ['list', 'upsert'],
  agents: ['createOrUpdateAgent', 'resync', 'runNow', 'toggleActive', 'list', 'remove', 'listExecutions'],
  leads: ['list', 'getOne', 'update', 'remove', 'stats', 'bulkUpdate'],
};

for (const [ctrlName, methods] of Object.entries(requiredMethods)) {
  for (const method of methods) {
    if (typeof controllers[ctrlName][method] !== 'function') {
      console.error(`ERRO CRITICO: controllers.${ctrlName}.${method} nao existe!`);
      console.error(`Tipo recebido: ${typeof controllers[ctrlName][method]}`);
      process.exit(1);
    }
  }
}

const router = express.Router();

// Nichos
router.get('/', controllers.niches.list);
router.post('/', controllers.niches.create);
router.get('/:id', controllers.niches.getOne);
router.put('/:id', controllers.niches.update);
router.delete('/:id', controllers.niches.remove);

// Palavras-chave
router.get('/:nicheId/keywords', controllers.keywords.list);
router.post('/:nicheId/keywords', controllers.keywords.bulkCreate);
router.put('/:nicheId/keywords/:id', controllers.keywords.update);
router.delete('/:nicheId/keywords/:id', controllers.keywords.remove);

// Templates de mensagem
router.get('/:nicheId/templates', controllers.templates.list);
router.post('/:nicheId/templates', controllers.templates.create);
router.put('/:nicheId/templates/:id', controllers.templates.update);
router.delete('/:nicheId/templates/:id', controllers.templates.remove);

// Credenciais
router.get('/:nicheId/credentials', controllers.credentials.list);
router.put('/:nicheId/credentials', controllers.credentials.upsert);

// Agentes n8n
router.get('/:nicheId/agents', controllers.agents.list);
router.post('/:nicheId/agents', controllers.agents.createOrUpdateAgent);
router.post('/:nicheId/agents/:id/resync', controllers.agents.resync);
router.post('/:nicheId/agents/:id/run', controllers.agents.runNow);
router.patch('/:nicheId/agents/:id/active', controllers.agents.toggleActive);
router.delete('/:nicheId/agents/:id', controllers.agents.remove);
router.get('/:nicheId/agents/:id/executions', controllers.agents.listExecutions);

// Leads (CRUD completo)
router.get('/:nicheId/leads', controllers.leads.list);
router.get('/:nicheId/leads/stats', controllers.leads.stats);
router.get('/:nicheId/leads/:id', controllers.leads.getOne);
router.put('/:nicheId/leads/:id', controllers.leads.update);
router.delete('/:nicheId/leads/:id', controllers.leads.remove);
router.post('/:nicheId/leads/bulk', controllers.leads.bulkUpdate);

module.exports = router;
