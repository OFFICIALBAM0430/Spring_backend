
const express = require('express');
const { getProfile } = require('../controllers/user.controllers');
const authenticate = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/me', authenticate, getProfile);

module.exports = router;
