
const express = require('express');
const router = express.Router();

const {
  initializePayment,
  verifyPayment,
} = require('../controllers/payment.controllers');

const authenticate = require('../middleware/auth.middleware');

router.post('/initialize', authenticate, initializePayment);
router.post('/verify', authenticate, verifyPayment);

module.exports = router;
