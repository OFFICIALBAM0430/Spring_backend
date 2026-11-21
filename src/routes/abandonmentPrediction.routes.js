const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth.middleware');
const controller = require('../controllers/abandonmentPrediction.controllers');
router.post('/', authenticate, controller.predictAbandonment);
module.exports = router;
