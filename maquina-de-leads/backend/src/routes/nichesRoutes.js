const express = require('express');

const controllers = {
  niches: require('../controllers/nichesController'),
  keywords: require('../controllers/keywordsController'),
  templates: require('../controllers/messageTemplatesController'),
  credentials: require('../controllers/credentialsController'),
  leads: require('../controllers/leadsController'),
};

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

router.get('/:nicheId/templates', controllers.templates.list);
router.post('/:nicheId/templates', controllers.templates.create);
router.put('/:nicheId/templates/:id', controllers.templates.update);
router.delete('/:nicheId/templates/:id', controllers.templates.remove);

router.get('/:nicheId/credentials', controllers.credentials.list);
router.put('/:nicheId/credentials', controllers.credentials.upsert);

router.get('/:nicheId/leads', controllers.leads.list);
router.get('/:nicheId/leads/stats', controllers.leads.stats);
router.get('/:nicheId/leads/:id', controllers.leads.getOne);
router.put('/:nicheId/leads/:id', controllers.leads.update);
router.delete('/:nicheId/leads', controllers.leads.clearNicheLeads);
router.delete('/:nicheId/leads/:id', controllers.leads.remove);
router.post('/:nicheId/leads/bulk', controllers.leads.bulkUpdate);

module.exports = router;
