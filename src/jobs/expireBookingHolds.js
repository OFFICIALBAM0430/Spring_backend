
const { db } = require('../config/database');

async function expireBookingHolds() {
  try {
    const expiredBookings = await db('bookings')
      .where('status', 'pending')
      .whereNotNull('hold_expires_at')
      .where('hold_expires_at', '<=', db.fn.now())
      .update({
        status: 'expired',
        updated_at: db.fn.now()
      })
      .returning('id');

    if (expiredBookings.length > 0) {
      console.log(
        `${expiredBookings.length} booking hold(s) expired`
      );
    }

  } catch (error) {
    console.error('Booking hold expiry failed:', error.message);
  }
}

function startBookingExpiryJob() {
  
  expireBookingHolds();


  setInterval(expireBookingHolds, 60 * 1000);

  console.log('Booking expiry job started');
}

module.exports = {
  expireBookingHolds,
  startBookingExpiryJob
};
