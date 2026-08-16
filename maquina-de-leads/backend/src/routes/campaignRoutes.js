const express = require('express');
const controller = require('../controllers/campaignsController');

const router = express.Router();
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/run', controller.run);
router.patch('/:id/leads/:leadId/stage', controller.updateLeadStage);

module.exports = router;
