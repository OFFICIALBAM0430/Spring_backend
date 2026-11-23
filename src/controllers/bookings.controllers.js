
const { db } = require('../config/database');
const generateReference = require('../utils/generateReference');

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

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

    if (
      !validDate(checkInDate) ||
      !validDate(checkOutDate) ||
      checkOutDate <= checkInDate
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
        .where({
          id: roomTypeId,
          is_active: true
        })
        .forUpdate()
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

      const prepSetting = await trx('platform_settings')
        .where({ key: 'room_preparation_minutes' })
        .first('value');

      const preparationMinutes = prepSetting
        ? Number(prepSetting.value)
        : 120;

      if (
        !Number.isFinite(preparationMinutes) ||
        preparationMinutes < 0
      ) {
        const error = new Error('Invalid room preparation setting');
        error.statusCode = 500;
        throw error;
      }

  
      const availableRoom = await trx('rooms as r')
        .where('r.room_type_id', roomTypeId)
        .whereIn('r.status', ['active', 'ready'])
        .whereNotExists(function () {
          this.select('*')
            .from('bookings as b')
            .whereRaw('b.room_id = r.id')
            .whereIn('b.status', [
              'pending',
              'confirmed',
              'checked_in',
              'completed'
            ])
            .whereRaw(
              `b.check_in_date::timestamp + interval '9 hours'
               < (?::date::timestamp + interval '12 hours')`,
              [checkOutDate]
            )
            .whereRaw(
              `b.check_out_date::timestamp
               + interval '12 hours'
               + (? * interval '1 minute')
               > (?::date::timestamp + interval '9 hours')`,
              [preparationMinutes, checkInDate]
            )
            .where(function () {
              this.whereIn('b.status', [
                'confirmed',
                'checked_in',
                'completed'
              ]).orWhere(function () {
                this.where('b.status', 'pending')
                  .where('b.hold_expires_at', '>', trx.fn.now());
              });
            });
        })
        .select('r.id', 'r.room_number')
        .orderBy('r.room_number')
        .forUpdate()
        .skipLocked()
        .first();

      if (!availableRoom) {
        const error = new Error(
          'No rooms available for the selected dates'
        );
        error.statusCode = 409;
        throw error;
      }

      const checkIn = new Date(`${checkInDate}T00:00:00.000Z`);
      const checkOut = new Date(`${checkOutDate}T00:00:00.000Z`);

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
          room_id: availableRoom.id,
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
      
