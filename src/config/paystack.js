const axios = require('axios');
const env = require('./env');
const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${env.paystackSecretKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});
module.exports = paystack;