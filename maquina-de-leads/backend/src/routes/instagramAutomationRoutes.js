const express = require('express');
const controller = require('../controllers/instagramAutomationController');

const router = express.Router();

router.get('/capabilities', controller.capabilities);
router.post('/generate', controller.generate);
router.post('/publish', controller.publish);

module.exports = router;
