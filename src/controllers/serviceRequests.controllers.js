const { db } = require('../config/database');
const generateReference = require('../utils/generateReference');

const CATEGORIES = ['housekeeping', 'food_beverage', 'maintenance'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const STATUSES = ['pending', 'acknowledged', 'assigned', 'in_progress', 'completed', 'cancelled'];
const MANAGEMENT_ROLES = ['administrator', 'receptionist'];

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function isManager(user) {
  return MANAGEMENT_ROLES.includes(user.role);
}

function canAccessRequest(request, user) {
  if (isManager(user)) return true;
  if (user.role === 'guest') return request.user_id === user.id;
  if (user.role === 'service_staff') return request.assigned_to === user.id;
  return false;
}

async function addHistory(trx, requestId, changedBy, previousStatus, newStatus, note) {
  await trx('service_request_histories').insert({
    service_request_id: requestId,
    changed_by: changedBy || null,
    previous_status: previousStatus || null,
    new_status: newStatus,
    note: note || null,
  });
}

exports.createServiceRequest = async (req, res, next) => {
  try {
    if (req.user.role !== 'guest') {
      return res.status(403).json({ success: false, message: 'Only guests can create service requests' });
    }

    const { booking_id = null, category, details, quantity = null, priority = 'normal' } = req.body || {};
    if (!CATEGORIES.includes(category)) return res.status(400).json({ success: false, message: `category must be one of: ${CATEGORIES.join(', ')}` });
    if (typeof details !== 'string' || details.trim().length < 3 || details.trim().length > 3000) {
      return res.status(400).json({ success: false, message: 'details must contain between 3 and 3000 characters' });
    }
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ success: false, message: `priority must be one of: ${PRIORITIES.join(', ')}` });
    if (quantity !== null && (!Number.isInteger(Number(quantity)) || Number(quantity) < 1)) {
      return res.status(400).json({ success: false, message: 'quantity must be a positive integer' });
    }
    if (booking_id !== null && (typeof booking_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking_id))) {
      return res.status(400).json({ success: false, message: 'booking_id must be a valid UUID' });
    }

    const created = await db.transaction(async (trx) => {
      if (booking_id) {
        const booking = await trx('bookings').where({ id: booking_id, user_id: req.user.id }).first();
        if (!booking) fail(400, 'The supplied booking does not belong to this guest or does not exist');
        if (!['confirmed', 'checked_in', 'completed'].includes(booking.status)) {
          fail(400, 'Service requests can only be linked to confirmed, checked-in, or completed bookings');
        }
      }

      const [request] = await trx('service_requests').insert({
        reference: generateReference('SR'),
        user_id: req.user.id,
        booking_id,
        category,
        details: details.trim(),
        quantity: quantity === null ? null : Number(quantity),
        priority,
        status: 'pending',
      }).returning('*');

      await addHistory(trx, request.id, req.user.id, null, 'pending', 'Service request created');
      return request;
    });

    return res.status(201).json({ success: true, message: 'Service request created', data: created });
  } catch (error) { return next(error); }
};

exports.getServiceRequestQueue = async (req, res, next) => {
  try {
    if (!['administrator', 'receptionist', 'service_staff'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Staff access is required' });
    }
    const { status, category, assigned_to } = req.query;
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 100;
    if (status && !STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status filter' });
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ success: false, message: 'Invalid category filter' });

    const query = db('service_requests as sr')
      .leftJoin('users as guest', 'sr.user_id', 'guest.id')
      .leftJoin('users as staff', 'sr.assigned_to', 'staff.id')
      .select('sr.*', 'guest.first_name as guest_first_name', 'guest.last_name as guest_last_name', 'staff.first_name as staff_first_name', 'staff.last_name as staff_last_name')
      .orderBy('sr.created_at', 'desc').limit(limit);

    if (req.user.role === 'service_staff') query.where('sr.assigned_to', req.user.id);
    else if (assigned_to) query.where('sr.assigned_to', assigned_to);
    if (status) query.where('sr.status', status);
    if (category) query.where('sr.category', category);

    const requests = await query;
    return res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) { return next(error); }
};

exports.getMyServiceRequests = async (req, res, next) => {
  try {
    if (req.user.role !== 'guest') return res.status(403).json({ success: false, message: 'Guest access is required' });
    const requests = await db('service_requests').where({ user_id: req.user.id }).orderBy('created_at', 'desc');
    return res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) { return next(error); }
};

async function findAccessibleRequest(id, user) {
  const request = await db('service_requests').where({ id }).first();
  if (!request || !canAccessRequest(request, user)) return null;
  return request;
}

exports.getServiceRequestById = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.id, req.user);
    if (!request) return res.status(404).json({ success: false, message: 'Service request not found' });
    const history = await db('service_request_histories as h')
      .leftJoin('users as u', 'h.changed_by', 'u.id')
      .where('h.service_request_id', request.id)
      .select('h.*', db.raw("CASE WHEN u.id IS NULL THEN NULL ELSE concat(u.first_name, ' ', u.last_name) END as changed_by_name"))
      .orderBy('h.created_at', 'asc');
    return res.status(200).json({ success: true, data: { ...request, history } });
  } catch (error) { return next(error); }
};

exports.getServiceRequestHistory = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.id, req.user);
    if (!request) return res.status(404).json({ success: false, message: 'Service request not found' });
    const history = await db('service_request_histories as h')
      .leftJoin('users as u', 'h.changed_by', 'u.id')
      .where('h.service_request_id', request.id)
      .select('h.*', db.raw("CASE WHEN u.id IS NULL THEN NULL ELSE concat(u.first_name, ' ', u.last_name) END as changed_by_name"))
      .orderBy('h.created_at', 'asc');
    return res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) { return next(error); }
};

exports.assignServiceRequest = async (req, res, next) => {
  try {
    if (!isManager(req.user)) return res.status(403).json({ success: false, message: 'Administrator or receptionist access is required' });
    const { staff_id, note = null } = req.body || {};
    if (typeof staff_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staff_id)) {
      return res.status(400).json({ success: false, message: 'A valid staff_id UUID is required' });
    }
    if (note !== null && (typeof note !== 'string' || note.length > 1000)) return res.status(400).json({ success: false, message: 'note must be 1000 characters or fewer' });

    const updated = await db.transaction(async (trx) => {
      const request = await trx('service_requests').where({ id: req.params.id }).forUpdate().first();
      if (!request) fail(404, 'Service request not found');
      if (['completed', 'cancelled'].includes(request.status)) fail(409, 'Completed or cancelled requests cannot be reassigned');
      const staff = await trx('users').where({ id: staff_id, role: 'service_staff', is_active: true }).first('id');
      if (!staff) fail(400, 'staff_id must identify an active service staff member');
      const nextStatus = ['pending', 'acknowledged'].includes(request.status) ? 'assigned' : request.status;
      const [result] = await trx('service_requests').where({ id: request.id }).update({
        assigned_to: staff_id,
        status: nextStatus,
        updated_at: trx.fn.now(),
      }).returning('*');
      if (nextStatus !== request.status) await addHistory(trx, request.id, req.user.id, request.status, nextStatus, note || 'Request assigned');
      else await addHistory(trx, request.id, req.user.id, request.status, request.status, note || 'Request reassigned');
      return result;
    });
    return res.status(200).json({ success: true, message: 'Service request assigned successfully', data: updated });
  } catch (error) { return next(error); }
};

exports.updateServiceRequestStatus = async (req, res, next) => {
  try {
    const { status, note = null } = req.body || {};
    const allowed = ['acknowledged', 'in_progress', 'completed', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: `status must be one of: ${allowed.join(', ')}` });
    if (note !== null && (typeof note !== 'string' || note.length > 1000)) return res.status(400).json({ success: false, message: 'note must be 1000 characters or fewer' });
    if (status === 'cancelled' && !isManager(req.user)) return res.status(403).json({ success: false, message: 'Only administrators or receptionists can cancel requests' });
    if (!['administrator', 'receptionist', 'service_staff'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Staff access is required' });

    const updated = await db.transaction(async (trx) => {
      const request = await trx('service_requests').where({ id: req.params.id }).forUpdate().first();
      if (!request) fail(404, 'Service request not found');
      if (req.user.role === 'service_staff' && request.assigned_to !== req.user.id) fail(403, 'You can update only requests assigned to you');
      if (['completed', 'cancelled'].includes(request.status)) fail(409, 'This service request is already closed');

      const transitions = {
        pending: ['acknowledged'],
        acknowledged: ['in_progress'],
        assigned: ['acknowledged', 'in_progress'],
        in_progress: ['completed'],
      };
      if (!(transitions[request.status] || []).includes(status) && !(isManager(req.user) && status === 'cancelled')) {
        fail(409, `Cannot change service request status from ${request.status} to ${status}`);
      }

      const changes = { status, updated_at: trx.fn.now() };
      if (status === 'acknowledged') changes.acknowledged_at = trx.fn.now();
      if (status === 'completed') changes.completed_at = trx.fn.now();
      const [result] = await trx('service_requests').where({ id: request.id }).update(changes).returning('*');
      await addHistory(trx, request.id, req.user.id, request.status, status, note);
      return result;
    });
    return res.status(200).json({ success: true, message: 'Service request status updated successfully', data: updated });
  } catch (error) { return next(error); }
};
