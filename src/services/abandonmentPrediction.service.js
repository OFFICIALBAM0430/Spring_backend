const axios = require('axios');

exports.getAbandonmentPrediction = async (bookingFeatures) => {
  const serviceUrl = process.env.ABANDONMENT_MODEL_SERVICE_URL;
  const serviceToken = process.env.ABANDONMENT_MODEL_SERVICE_TOKEN;
  if (!serviceUrl || !serviceToken) {
    const error = new Error('Abandonment prediction service is not configured');
    error.statusCode = 503;
    throw error;
  }
  try {
    const response = await axios.post(
      `${serviceUrl.replace(/\/$/, '')}/predict`,
      bookingFeatures,
      {
        timeout: 15000,
        headers: { 'x-service-token': serviceToken },
      },
    );
    return response.data.data;
  } catch (cause) {
    const error = new Error(
      cause.response?.status === 422
        ? 'Prediction service rejected the supplied booking details'
        : 'Abandonment prediction service is temporarily unavailable',
    );
    error.statusCode = cause.response?.status === 422 ? 400 : 503;
    throw error;
  }
};
      
