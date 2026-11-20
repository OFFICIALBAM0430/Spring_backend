const { db } = require('../config/database');

const getRooms = async (req, res, next) => {
  try {
    const rooms = await db('rooms as r')
      .join('room_types as rt', 'r.room_type_id', 'rt.id')
      .select(
        'r.id',
        'r.room_number',
        'r.floor',
        'r.status',
        'r.description',
        'rt.id as room_type_id',
        'rt.name as room_type',
        'rt.price_per_night'
      )
      .orderBy('r.room_number');

    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (error) {
    next(error);
  }
};

const getRoomById = async (req, res, next) => {
  try {
    const room = await db('rooms as r')
      .join('room_types as rt', 'r.room_type_id', 'rt.id')
      .where('r.id', req.params.id)
      .select(
        'r.id',
        'r.room_number',
        'r.floor',
        'r.status',
        'r.description',
        'rt.id as room_type_id',
        'rt.name as room_type',
        'rt.price_per_night'
      )
      .first();

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    res.status(200).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

const getRoomAvailability = async (req, res, next) => {
  try {
    const { check_in_date, check_out_date } = req.query;

    if (!check_in_date || !check_out_date) {
      return res.status(400).json({
        success: false,
        message: 'Check-in and check-out dates are required',
      });
    }

    const checkIn = new Date(check_in_date);
    const checkOut = new Date(check_out_date);

    if (
      Number.isNaN(checkIn.getTime()) ||
      Number.isNaN(checkOut.getTime()) ||
      checkOut <= checkIn
    ) {
      return res.status(400).json({
        success: false,
        message: 'Provide valid dates. Check-out must be after check-in.',
      });
    }

    const rooms = await db('rooms as r')
      .join('room_types as rt', 'r.room_type_id', 'rt.id')
      .where('r.status', 'active')
      .whereNotExists(function () {
        this.select('*')
          .from('bookings as b')
          .whereRaw('b.room_id = r.id')
          .whereIn('b.status', ['pending', 'confirmed'])
          .whereRaw('b.check_in_date < ?', [check_out_date])
          .whereRaw('b.check_out_date > ?', [check_in_date])
          .where(function () {
            this.where('b.status', 'confirmed')
              .orWhere(function () {
                this.where('b.status', 'pending')
                  .where('b.hold_expires_at', '>', db.fn.now());
              });
          });
      })
      .select(
        'r.id',
        'r.room_number',
        'r.floor',
        'r.description',
        'rt.id as room_type_id',
        'rt.name as room_type',
        'rt.price_per_night'
      )
      .orderBy('rt.name')
      .orderBy('r.room_number');

    res.status(200).json({
      success: true,
      count: rooms.length,
      check_in_date,
      check_out_date,
      data: rooms,
    });
  } catch (error) {
    next(error);
  }
};

const updateRoomStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['active', 'maintenance', 'out_of_service'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room status',
      });
    }

    const updated = await db('rooms')
      .where({ id: req.params.id })
      .update({
        status,
        updated_at: db.fn.now(),
      })
      .returning('*');

    if (!updated.length) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Room status updated',
      data: updated[0],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRooms,
  getRoomById,
  getRoomAvailability,
  updateRoomStatus,
};

function selectApplicableRate(rateDate) {
  return [
    db.raw(
      `(
        SELECT rr.amount_per_night
        FROM room_rates rr
        WHERE rr.category_id = r.category_id
          AND rr.is_active = true
          AND rr.effective_from <= ?::date
          AND (rr.effective_to IS NULL OR rr.effective_to >= ?::date)
        ORDER BY rr.effective_from DESC, rr.id DESC
        LIMIT 1
      ) AS amount_per_night`,
      [rateDate, rateDate],
    ),
    db.raw(
      `(
        SELECT rr.currency
        FROM room_rates rr
        WHERE rr.category_id = r.category_id
          AND rr.is_active = true
          AND rr.effective_from <= ?::date
          AND (rr.effective_to IS NULL OR rr.effective_to >= ?::date)
        ORDER BY rr.effective_from DESC, rr.id DESC
        LIMIT 1
      ) AS currency`,
      [rateDate, rateDate],
    ),
  ];
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

async function listRooms(req, res) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const rooms = await db('rooms as r')
      .join('room_categories as c', 'c.id', 'r.category_id')
      .select(
        'r.id',
        'r.identifier',
        'r.status',
        'c.id as category_id',
        'c.name as category',
        'c.capacity',
        ...selectApplicableRate(today),
      )
      .orderBy('r.identifier');

    return res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    console.error('List rooms error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve rooms',
    });
  }
}

async function getRoom(req, res) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const room = await db('rooms as r')
      .join('room_categories as c', 'c.id', 'r.category_id')
      .where('r.id', req.params.id)
      .select(
        'r.id',
        'r.identifier',
        'r.status',
        'r.notes',
        'c.id as category_id',
        'c.name as category',
        'c.capacity',
        ...selectApplicableRate(today),
      )
      .first();

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error('Get room error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve room',
    });
  }
}

async function checkAvailability(req, res) {
  try {
    const { check_in, check_out, category, guests } = req.query;

    if (!check_in || !check_out) {
      return res.status(400).json({
        success: false,
        message: 'check_in and check_out are required',
      });
    }

    if (!isValidDateOnly(check_in) || !isValidDateOnly(check_out)) {
      return res.status(400).json({
        success: false,
        message: 'Dates must be valid and use YYYY-MM-DD format',
      });
    }

    if (check_out <= check_in) {
      return res.status(400).json({
        success: false,
        message: 'check_out must be after check_in',
      });
    }

    if (guests !== undefined) {
      const guestCount = Number(guests);

      if (!Number.isInteger(guestCount) || guestCount < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid guest count',
        });
      }
    }

  
    const hasBookingRooms = await db.schema.hasTable('booking_rooms');
    const hasBookings = await db.schema.hasTable('bookings');

    if (!hasBookingRooms || !hasBookings) {
      return res.status(503).json({
        success: false,
        message: 'Room availability is temporarily unavailable',
      });
    }

    const checkIn = new Date(`${check_in}T09:00:00`);
    const checkOut = new Date(`${check_out}T12:00:00`);


    const preparationSetting = await db('platform_settings')
      .where({ key: 'room_preparation_minutes' })
      .first();

    const preparationMinutes = preparationSetting
      ? Number(preparationSetting.value)
      : 120;

    if (
      !Number.isInteger(preparationMinutes) ||
      preparationMinutes < 0
    ) {
      throw new Error('Invalid room preparation setting');
    }

    let query = db('rooms as r')
      .join('room_categories as c', 'c.id', 'r.category_id')
      .where('r.status', 'ready')
      .where('c.is_active', true);

    if (category) {
      query = query.whereILike('c.name', category);
    }

    if (guests !== undefined) {
      query = query.where('c.capacity', '>=', Number(guests));
    }


    query = query.whereNotExists(function () {
      this.select('*')
        .from('booking_rooms as br')
        .join('bookings as b', 'b.id', 'br.booking_id')
        .whereRaw('br.room_id = r.id')
        .whereIn('b.status', [
          'confirmed',
          'checked_in',
          'held',
        ])
        .whereRaw(
          `b.check_in_at < ?
           AND (
             b.check_out_at + (? * INTERVAL '1 minute')
           ) > ?`,
          [checkOut, preparationMinutes, checkIn],
        );
    });

    const rooms = await query
      .select(
        'r.id',
        'r.identifier',
        'c.id as category_id',
        'c.name as category',
        'c.capacity',
        ...selectApplicableRate(check_in),
      )
      .orderBy('c.name')
      .orderBy('r.identifier');

    return res.status(200).json({
      success: true,
      data: {
        check_in,
        check_out,
        rooms,
      },
    });
  } catch (error) {
    console.error('Check availability error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to check room availability',
    });
  }
}

async function updateRoomStatus(req, res) {
  try {
    const { status, notes } = req.body;

    const allowedStatuses = ['ready', 'cleaning'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const update = {
      status,
      updated_at: new Date(),
    };

    if (notes !== undefined) {
      update.notes = notes;
    }

    const updated = await db('rooms')
      .where({ id: req.params.id })
      .update(update)
      .returning('*');

    if (!updated.length) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: updated[0],
    });
  } catch (error) {
    console.error('Update room status error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to update room status',
    });
  }
}

module.exports = {
  listRooms,
  getRoom,
  checkAvailability,
  updateRoomStatus,
};
