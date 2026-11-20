
const express = require('express');
const router = express.Router();

const {
  getRooms,
  getRoomById,
  getRoomAvailability,
  updateRoomStatus,
} = require('../controllers/room.controllers');

const authenticate = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

router.get('/', getRooms);
router.get('/availability', getRoomAvailability);
router.get('/:id', getRoomById);

router.patch(
  '/:id/status',
  authenticate,
  requireRole('administrator', 'receptionist', 'service_staff'),
  updateRoomStatus
);

module.exports = router;
