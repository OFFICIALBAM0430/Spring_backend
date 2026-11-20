const { db } = require('../config/database');
const generateReference = require('../utils/generateReference');

exports.createBooking = async (req, res, next) => {
  try {
    const {
      roomTypeId,
      checkInDate,
      checkOutDate,
      numberOfGuests
    } = req.body;
    const userId = req.user.id;
    if (!roomTypeId || !checkInDate || !checkOutDate) {
      return res.status(400).json({
        success: false,
        message: 'Room type, check-in and check-out dates are required'
      });
    }
    const checkIn = new Date(`${checkInDate}T00:00:00Z`);
    const checkOut = new Date(`${checkOutDate}T00:00:00Z`);
    if (
      Number.isNaN(checkIn.getTime()) ||
      Number.isNaN(checkOut.getTime()) ||
      checkOut <= checkIn
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking dates'
      });
    }
    const guests = Number(numberOfGuests || 1);
    if (!Number.isInteger(guests) || guests < 1) {
      return res.status(400).json({
        success: false,
        message: 'Number of guests must be at least 1'
      });
    }
    const booking = await db.transaction(async (trx) => {
      const roomType = await trx('room_types')
        .where({ id: roomTypeId, is_active: true })
        .first();
      if (!roomType) {
        const error = new Error('Room type not found or inactive');
        error.statusCode = 404;
        throw error;
      }
      if (roomType.price_per_night === null) {
        const error = new Error('Room rate has not been configured');
        error.statusCode = 400;
        throw error;
      }
      
      await trx('room_types')
        .where({ id: roomTypeId })
        .forUpdate()
        .first();
      const availableRooms = await trx('rooms')
        .where({
          room_type_id: roomTypeId,
          status: 'active'
        })
        .count('* as total')
        .first();
      const occupiedRooms = await trx('bookings')
        .where({ room_type_id: roomTypeId })
        .whereIn('status', ['pending', 'confirmed'])
        .where('check_in_date', '<', checkOutDate)
        .where('check_out_date', '>', checkInDate)
        .where(function () {
          this.whereNull('hold_expires_at')
            .orWhere('hold_expires_at', '>', trx.fn.now());
        })
        .count('* as total')
        .first();
      if (Number(availableRooms.total) <= Number(occupiedRooms.total)) {
        const error = new Error('No rooms available for the selected dates');
        error.statusCode = 409;
        throw error;
      }
      const nights = Math.round(
        (checkOut - checkIn) / (1000 * 60 * 60 * 24)
      );
      const totalAmount = (
        Number(roomType.price_per_night) * nights
      ).toFixed(2);
      const [createdBooking] = await trx('bookings')
        .insert({
          booking_reference: generateReference('BOOK'),
          user_id: userId,
          room_type_id: roomTypeId,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          number_of_guests: guests,
          total_amount: totalAmount,
          status: 'pending',
          hold_expires_at: trx.raw(
            "CURRENT_TIMESTAMP + INTERVAL '30 minutes'"
          )
        })
        .returning('*');
      return createdBooking;
    });
    return res.status(201).json({
      success: true,
      message: 'Booking created. Complete payment within 30 minutes.',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyBookings = async (req, res, next) => {
  try {
    const bookings = await db('bookings')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc');
    return res.status(200).json({
      success: true,
      message: 'Bookings retrieved successfully',
      data: bookings
    });
  } catch (error) {
    next(error);
  }
};

exports.getBookingById = async (req, res, next) => {
  try {
    const booking = await db('bookings')
      .where({
        id: req.params.id,
        user_id: req.user.id
      })
      .first();
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Booking retrieved successfully',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};