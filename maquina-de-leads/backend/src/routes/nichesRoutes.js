const express = require('express');

const controllers = {
  niches: require('../controllers/nichesController'),
  keywords: require('../controllers/keywordsController'),
  templates: require('../controllers/messageTemplatesController'),
  credentials: require('../controllers/credentialsController'),
  leads: require('../controllers/leadsController'),
  nativeJobs: require('../controllers/nativeJobsController'),
  nativeRecovery: require('../controllers/nativeRecoveryController'),
  lifecycle: require('../controllers/campaignLifecycleController'),
  aiKeywords: require('../controllers/aiKeywordsController'),
};

const requiredMethods = {
  niches: ['list', 'create', 'getOne', 'update', 'remove'],
  keywords: ['list', 'bulkCreate', 'update', 'remove'],
  templates: ['list', 'create', 'update', 'remove'],
  credentials: ['list', 'upsert'],
  leads: ['list', 'getOne', 'update', 'remove', 'clearNicheLeads', 'stats', 'bulkUpdate'],
  nativeJobs: ['startDiscovery','startEnrichment','startScoring','startSending','activate','pause','resume','processBatch','list','executions'],
  nativeRecovery: ['recover'],
  lifecycle: ['complete'],
  aiKeywords: ['generate', 'listRuns', 'chat', 'chatHistory', 'clearChat'],
};

for (const [ctrlName, methods] of Object.entries(requiredMethods)) {
  for (const method of methods) {
    if (typeof controllers[ctrlName][method] !== 'function') {
      console.error(`ERRO CRITICO: controllers.${ctrlName}.${method} nao existe!`);
      process.exit(1);
    }
  }
}

const router = express.Router();

router.get('/', controllers.niches.list);
router.post('/', controllers.niches.create);
router.get('/:id', controllers.niches.getOne);
router.put('/:id', controllers.niches.update);
router.delete('/:id', controllers.niches.remove);

router.get('/:nicheId/keywords', controllers.keywords.list);
router.post('/:nicheId/keywords', controllers.keywords.bulkCreate);
router.put('/:nicheId/keywords/:id', controllers.keywords.update);
router.delete('/:nicheId/keywords/:id', controllers.keywords.remove);
router.post('/:nicheId/ai/keywords/generate', controllers.aiKeywords.generate);
router.get('/:nicheId/ai/keyword-runs', controllers.aiKeywords.listRuns);
router.post('/:nicheId/ai/keywords/chat', controllers.aiKeywords.chat);
router.get('/:nicheId/ai/keywords/chat', controllers.aiKeywords.chatHistory);
router.delete('/:nicheId/ai/keywords/chat', controllers.aiKeywords.clearChat);

router.get('/:nicheId/templates', controllers.templates.list);
router.post('/:nicheId/templates', controllers.templates.create);
router.put('/:nicheId/templates/:id', controllers.templates.update);
router.delete('/:nicheId/templates/:id', controllers.templates.remove);

router.get('/:nicheId/credentials', controllers.credentials.list);
router.put('/:nicheId/credentials', controllers.credentials.upsert);

router.post('/:nicheId/native/discover', controllers.nativeJobs.startDiscovery);
router.post('/:nicheId/native/enrich', controllers.nativeJobs.startEnrichment);
router.post('/:nicheId/native/score', controllers.nativeJobs.startScoring);
router.post('/:nicheId/native/send', controllers.nativeJobs.startSending);
router.post('/:nicheId/native/activate', controllers.nativeJobs.activate);
router.post('/:nicheId/native/pause', controllers.nativeJobs.pause);
router.post('/:nicheId/native/resume', controllers.nativeJobs.resume);
router.post('/:nicheId/native/process', controllers.nativeJobs.processBatch);
router.post('/:nicheId/native/recover', controllers.nativeRecovery.recover);
router.post('/:nicheId/native/complete', controllers.lifecycle.complete);
router.get('/:nicheId/native/jobs', controllers.nativeJobs.list);
router.get('/:nicheId/native/jobs/:jobId/executions', controllers.nativeJobs.executions);

router.get('/:nicheId/leads', controllers.leads.list);
router.get('/:nicheId/leads/stats', controllers.leads.stats);
router.get('/:nicheId/leads/:id', controllers.leads.getOne);
router.put('/:nicheId/leads/:id', controllers.leads.update);
router.delete('/:nicheId/leads', controllers.leads.clearNicheLeads);
router.delete('/:nicheId/leads/:id', controllers.leads.remove);
router.post('/:nicheId/leads/bulk', controllers.leads.bulkUpdate);

module.exports = router;
