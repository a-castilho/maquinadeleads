const express = require('express');

const controllers = {
  niches: require('../controllers/nichesController'),
  keywords: require('../controllers/keywordsController'),
  templates: require('../controllers/messageTemplatesController'),
  credentials: require('../controllers/credentialsController'),
  leads: require('../controllers/leadsController'),
  nativeJobs: require('../controllers/nativeJobsController'),
};

const requiredMethods = {
  niches: ['list', 'create', 'getOne', 'update', 'remove'],
  keywords: ['list', 'bulkCreate', 'update', 'remove'],
  templates: ['list', 'create', 'update', 'remove'],
  credentials: ['list', 'upsert'],
  leads: ['list', 'getOne', 'update', 'remove', 'clearNicheLeads', 'stats', 'bulkUpdate'],
  nativeJobs: ['startDiscovery', 'startEnrichment', 'startSending', 'list', 'executions'],
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

// Campanhas. A entidade interna continua se chamando `niches` para manter
// compatibilidade com o banco existente durante a migração.
router.get('/', controllers.niches.list);
router.post('/', controllers.niches.create);
router.get('/:id', controllers.niches.getOne);
router.put('/:id', controllers.niches.update);
router.delete('/:id', controllers.niches.remove);

// Estratégia de busca
router.get('/:nicheId/keywords', controllers.keywords.list);
router.post('/:nicheId/keywords', controllers.keywords.bulkCreate);
router.put('/:nicheId/keywords/:id', controllers.keywords.update);
router.delete('/:nicheId/keywords/:id', controllers.keywords.remove);

// Mensagens
router.get('/:nicheId/templates', controllers.templates.list);
router.post('/:nicheId/templates', controllers.templates.create);
router.put('/:nicheId/templates/:id', controllers.templates.update);
router.delete('/:nicheId/templates/:id', controllers.templates.remove);

// Integrações nativas da campanha
router.get('/:nicheId/credentials', controllers.credentials.list);
router.put('/:nicheId/credentials', controllers.credentials.upsert);

// Execução nativa
router.post('/:nicheId/native/discover', controllers.nativeJobs.startDiscovery);
router.post('/:nicheId/native/enrich', controllers.nativeJobs.startEnrichment);
router.post('/:nicheId/native/send', controllers.nativeJobs.startSending);
router.get('/:nicheId/native/jobs', controllers.nativeJobs.list);
router.get('/:nicheId/native/jobs/:jobId/executions', controllers.nativeJobs.executions);

// Leads
router.get('/:nicheId/leads', controllers.leads.list);
router.get('/:nicheId/leads/stats', controllers.leads.stats);
router.get('/:nicheId/leads/:id', controllers.leads.getOne);
router.put('/:nicheId/leads/:id', controllers.leads.update);
router.delete('/:nicheId/leads', controllers.leads.clearNicheLeads);
router.delete('/:nicheId/leads/:id', controllers.leads.remove);
router.post('/:nicheId/leads/bulk', controllers.leads.bulkUpdate);

module.exports = router;
