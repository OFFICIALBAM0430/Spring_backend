const crypto = require('crypto');
const env = require('../config/env');
const { db } = require('../config/database');
const paystack = require('../config/paystack');
const generateReference = require('../utils/generateReference');

exports.initializePayment = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    const booking = await db('bookings')
      .where({
        id: bookingId,
        user_id: req.user.id
      })
      .first();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (
      booking.status !== 'pending' ||
      new Date(booking.hold_expires_at) <= new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Booking hold has expired or is no longer payable'
      });
    }

    const user = await db('users')
      .where({ id: req.user.id })
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const existingPayment = await db('payments')
      .where({ booking_id: booking.id })
      .whereIn('status', ['initialized', 'pending', 'successful'])
      .first();

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: 'A payment already exists for this booking',
        data: existingPayment
      });
    }

    const reference = generateReference('PAY');

    
    const amount = Math.round(Number(booking.total_amount) * 100);

    const response = await paystack.post('/transaction/initialize', {
      email: user.email,
      amount,
      reference,
      currency: 'NGN',
      callback_url: process.env.PAYSTACK_CALLBACK_URL
    });

    if (!response.data.status) {
      throw new Error('Paystack could not initialize payment');
    }

    const payment = await db('payments')
      .insert({
        booking_id: booking.id,
        reference,
        gateway: 'paystack',
        amount: booking.total_amount,
        currency: 'NGN',
        status: 'initialized'
      })
      .returning('*');

    return res.status(201).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        bookingId: booking.id,
        reference,
        authorizationUrl: response.data.data.authorization_url,
        payment
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    const payment = await db('payments')
      .where({ reference })
      .first();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    const booking = await db('bookings')
      .where({
        id: payment.booking_id,
        user_id: req.user.id
      })
      .first();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }


    if (payment.status === 'successful') {
      return res.status(200).json({
        success: true,
        message: 'Payment was already verified',
        data: {
          paymentStatus: 'successful',
          bookingStatus: booking.status
        }
      });
    }

    const response = await paystack.get(
      `/transaction/verify/${encodeURIComponent(reference)}`
    );

    const transaction = response.data.data;

    if (
      !response.data.status ||
      transaction.status !== 'success' ||
      transaction.reference !== reference ||
      Number(transaction.amount) !==
        Math.round(Number(payment.amount) * 100) ||
      transaction.currency !== payment.currency
    ) {
      await db('payments')
        .where({ id: payment.id })
        .update({ status: 'failed', updated_at: db.fn.now() });

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    const result = await db.transaction(async (trx) => {
      const lockedBooking = await trx('bookings')
        .where({ id: booking.id })
        .forUpdate()
        .first();

      const lockedPayment = await trx('payments')
        .where({ id: payment.id })
        .forUpdate()
        .first();

      if (lockedPayment.status === 'successful') {
        return {
          paymentStatus: 'successful',
          bookingStatus: lockedBooking.status
        };
      }

      await trx('payments')
        .where({ id: payment.id })
        .update({
          status: 'successful',
          gateway_transaction_id: String(transaction.id),
          channel: transaction.channel,
          gateway_response: transaction,
          paid_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });

      const holdValid =
        lockedBooking.status === 'pending' &&
        lockedBooking.hold_expires_at &&
        new Date(lockedBooking.hold_expires_at) > new Date();

      if (!holdValid) {
        return {
          paymentStatus: 'successful',
          bookingStatus: lockedBooking.status,
          requiresResolution: true
        };
      }

      await trx('room_types')
        .where({ id: lockedBooking.room_type_id })
        .forUpdate()
        .first();

      const roomCount = await trx('rooms')
        .where({
          room_type_id: lockedBooking.room_type_id,
          status: 'active'
        })
        .count('* as total')
        .first();

      const occupiedCount = await trx('bookings')
        .where({ room_type_id: lockedBooking.room_type_id })
        .whereNot('id', lockedBooking.id)
        .whereIn('status', ['pending', 'confirmed'])
        .where('check_in_date', '<', lockedBooking.check_out_date)
        .where('check_out_date', '>', lockedBooking.check_in_date)
        .where(function () {
          this.whereNull('hold_expires_at')
            .orWhere('hold_expires_at', '>', trx.fn.now());
        })
        .count('* as total')
        .first();

      if (Number(roomCount.total) <= Number(occupiedCount.total)) {
        return {
          paymentStatus: 'successful',
          bookingStatus: 'pending',
          requiresResolution: true
        };
      }

      await trx('bookings')
        .where({ id: lockedBooking.id })
        .update({
          status: 'confirmed',
          hold_expires_at: null,
          updated_at: trx.fn.now()
        });

      return {
        paymentStatus: 'successful',
        bookingStatus: 'confirmed'
      };
    });

    return res.status(200).json({
      success: true,
      message: result.requiresResolution
        ? 'Payment received. Booking requires administrative resolution.'
        : 'Payment verified successfully',
      data: result
    });

  } catch (error) {
    next(error);
  }
};


exports.handlePaystackWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-paystack-signature'];

    if (!signature || !Buffer.isBuffer(req.body)) {
      return res.status(400).send('Invalid webhook request');
    }

    const expectedSignature = crypto
      .createHmac('sha512', env.paystackSecretKey)
      .update(req.body)
      .digest();

    const receivedSignature = Buffer.from(signature, 'hex');

    if (
      receivedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return res.status(401).send('Invalid webhook signature');
    }

    const event = JSON.parse(req.body.toString());

    
    if (event.event !== 'charge.success') {
      return res.status(200).send('Event received');
    }

    const transaction = event.data;

    const payment = await db('payments')
      .where({ reference: transaction.reference })
      .first();

    if (!payment) {
      return res.status(200).send('Payment record not found');
    }

    if (
      Number(transaction.amount) !==
        Math.round(Number(payment.amount) * 100) ||
      transaction.currency !== payment.currency ||
      transaction.status !== 'success'
    ) {
      return res.status(400).send('Payment details do not match');
    }

    await db.transaction(async (trx) => {
      const lockedPayment = await trx('payments')
        .where({ id: payment.id })
        .forUpdate()
        .first();

      const booking = await trx('bookings')
        .where({ id: payment.booking_id })
        .forUpdate()
        .first();

      if (lockedPayment.status === 'successful') return;

      await trx('payments')
        .where({ id: payment.id })
        .update({
          status: 'successful',
          gateway_transaction_id: String(transaction.id),
          channel: transaction.channel,
          gateway_response: transaction,
          paid_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });

      const holdValid =
        booking.status === 'pending' &&
        booking.hold_expires_at &&
        new Date(booking.hold_expires_at) > new Date();

      if (!holdValid) return;

      await trx('room_types')
        .where({ id: booking.room_type_id })
        .forUpdate()
        .first();

      const roomCount = await trx('rooms')
        .where({
          room_type_id: booking.room_type_id,
          status: 'active'
        })
        .count('* as total')
        .first();

      const occupiedCount = await trx('bookings')
        .where({ room_type_id: booking.room_type_id })
        .whereNot('id', booking.id)
        .whereIn('status', ['pending', 'confirmed'])
        .where('check_in_date', '<', booking.check_out_date)
        .where('check_out_date', '>', booking.check_in_date)
        .where(function () {
          this.whereNull('hold_expires_at')
            .orWhere('hold_expires_at', '>', trx.fn.now());
        })
        .count('* as total')
        .first();

      if (Number(roomCount.total) <= Number(occupiedCount.total)) {
        return;
      }

      await trx('bookings')
        .where({ id: booking.id })
        .update({
          status: 'confirmed',
          hold_expires_at: null,
          updated_at: trx.fn.now()
        });
    });

    return res.status(200).send('Webhook processed');

  } catch (error) {
    next(error);
  }
};
