const dotenv = require('dotenv');
dotenv.config();
const env = {
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
};

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is missing from environment variables');
}

if (!env.jwtSecret) {
  throw new Error('JWT_SECRET is missing from environment variables');
}

module.exports = env;