
const express = require('express');
const router = express.Router();

const {
  createBooking,
  getMyBookings,
  getBookingById,
} = require('../controllers/bookings.controllers');

const authenticate = require('../middleware/auth.middleware');

router.post('/', authenticate, createBooking);
router.get('/my-bookings', authenticate, getMyBookings);
router.get('/:id', authenticate, getBookingById);

module.exports = router;
