
const { db } = require('../config/database');

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

async function getRooms(req, res, next) {
  try {
    let query = db('rooms as r').join('room_types as rt', 'r.room_type_id', 'rt.id');
    if (req.query.room_type) query = query.whereILike('rt.name', req.query.room_type);
    const rooms = await query.select(
      'r.id', 'r.room_number', 'r.floor', 'r.status', 'r.description',
      'rt.id as room_type_id', 'rt.name as room_type', 'rt.price_per_night'
    ).orderBy('rt.name').orderBy('r.room_number');
    return res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (error) { return next(error); }
}

async function getRoomById(req, res, next) {
  try {
    const room = await db('rooms as r').join('room_types as rt', 'r.room_type_id', 'rt.id')
      .where('r.id', req.params.id)
      .select(
        'r.id', 'r.room_number', 'r.floor', 'r.status', 'r.description',
        'rt.id as room_type_id', 'rt.name as room_type', 'rt.price_per_night'
      ).first();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    return res.status(200).json({ success: true, data: room });
  } catch (error) { return next(error); }
}

async function getRoomAvailability(req, res, next) {
  try {
    const { check_in_date, check_out_date, room_type } = req.query;
    if (!validDate(check_in_date) || !validDate(check_out_date) || check_out_date <= check_in_date) {
      return res.status(400).json({
        success: false,
        message: 'Provide valid check_in_date and check_out_date (YYYY-MM-DD); checkout must be after check-in'
      });
    }
    const prepSetting = await db('platform_settings').where({ key: 'room_preparation_minutes' }).first('value');
    const preparationMinutes = prepSetting ? Number(prepSetting.value) : 120;
    const rooms = await db('rooms as r').join('room_types as rt', 'r.room_type_id', 'rt.id')
      .where('r.status', 'ready')
      .modify((q) => { if (room_type) q.whereILike('rt.name', room_type); })
      .whereNotExists(function () {
        this.select('*').from('bookings as b').whereRaw('b.room_id = r.id')
          .whereIn('b.status', ['pending', 'confirmed', 'checked_in', 'completed'])
          .whereRaw("b.check_in_date::timestamp + interval '9 hours' < (?::date::timestamp + interval '12 hours')", [check_out_date])
          .whereRaw("b.check_out_date::timestamp + interval '12 hours' + (? * interval '1 minute') > (?::date::timestamp + interval '9 hours')", [preparationMinutes, check_in_date])
          .where((q) => q.whereIn('b.status', ['confirmed', 'checked_in', 'completed'])
            .orWhere((pending) => pending.where('b.status', 'pending')
              .where('b.hold_expires_at', '>', db.fn.now())));
      })
      .select(
        'r.id', 'r.room_number', 'r.floor',
        'rt.id as room_type_id', 'rt.name as room_type', 'rt.price_per_night'
      ).orderBy('rt.name').orderBy('r.room_number');
    return res.status(200).json({
      success: true, count: rooms.length, check_in_date, check_out_date, data: rooms
    });
  } catch (error) { return next(error); }
}

async function updateRoomStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ['ready', 'cleaning', 'maintenance', 'out_of_service'];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowed.join(', ')}`
      });
    }
    const [room] = await db('rooms').where({ id: req.params.id })
      .update({ status, updated_at: db.fn.now() }).returning('*');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    return res.status(200).json({
      success: true, message: 'Room status updated', data: room
    });
  } catch (error) { return next(error); }
}

module.exports = { getRooms, getRoomById, getRoomAvailability, updateRoomStatus };
