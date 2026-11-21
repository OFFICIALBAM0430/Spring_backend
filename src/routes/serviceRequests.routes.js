const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth.middleware');
const controller = require('../controllers/serviceRequests.controllers');

router.post('/', authenticate, controller.createServiceRequest);
router.get('/', authenticate, controller.getServiceRequestQueue);
router.get('/mine', authenticate, controller.getMyServiceRequests);
router.get('/:id/history', authenticate, controller.getServiceRequestHistory);
router.patch('/:id/assign', authenticate, controller.assignServiceRequest);
router.patch('/:id/status', authenticate, controller.updateServiceRequestStatus);
router.get('/:id', authenticate, controller.getServiceRequestById);

module.exports = router;
