const express = require('express');
const controller = require('../controllers/companyProfileController');

const router = express.Router();

router.get('/', controller.getProfile);
router.put('/', controller.upsertProfile);
router.post('/regenerate-keywords', controller.regenerateKeywords);
router.post('/generate-test', controller.generateTestProfile);

module.exports = router;
