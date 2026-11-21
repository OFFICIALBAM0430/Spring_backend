
require('dotenv').config();

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const errorHandler = require('./src/middleware/error.middleware');
const { dbJs } = require('./src/config/database');

const userRoutes = require('./src/routes/user.routes');
const authRoutes = require('./src/routes/auth.routes');
const bookingRoutes = require('./src/routes/booking.routes');
const paymentRoutes = require('./src/routes/payment.routes');
const roomRoutes = require('./src/routes/room.routes');
const serviceRequestsRoutes = require('./src/routes/serviceRequests.routes');
const abandonmentPredictionRoutes = require('./src/routes/abandonmentPrediction.routes');

const { startBookingExpiryJob } = require('./src/jobs/expireBookingHolds');
const {
  handlePaystackWebhook,
} = require('./src/controllers/payment.controllers');

const app = express();

app.use(cors());
app.use(morgan('dev'));


app.post(
  '/api/v1/payments/webhook',
  express.raw({ type: 'application/json' }),
  handlePaystackWebhook,
);

app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'DGEP API is running',
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/service-requests', serviceRequestsRoutes);
app.use('/api/v1/predictions/abandonment', abandonmentPredictionRoutes);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await dbJs();

    app.listen(PORT, () => {
      console.log(`DGEP server is running on port ${PORT}`);
      startBookingExpiryJob();
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
