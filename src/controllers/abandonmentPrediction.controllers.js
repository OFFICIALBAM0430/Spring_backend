const Joi = require('joi');
const { getAbandonmentPrediction } = require('../services/abandonmentPrediction.service');

const schema = Joi.object({
  Booking_Value_NGN: Joi.number().finite().min(0).required(),
  'Lead time': Joi.number().finite().min(0).required(),
  'Length of stay': Joi.number().finite().greater(0).required(),
  Room_Type: Joi.string().trim().min(1).required(),
  Device_Type: Joi.string().trim().min(1).required(),
  Channel: Joi.string().trim().min(1).required(),
}).unknown(false);

exports.predictAbandonment = async (req, res, next) => {
  try {
    const { error, value } = schema.validate(req.body, { abortEarly: false, convert: true });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid prediction input',
        errors: error.details.map((item) => item.message),
      });
    }
    const prediction = await getAbandonmentPrediction(value);
    return res.status(200).json({
      success: true,
      message: 'Abandonment prediction generated successfully',
      data: prediction,
    });
  } catch (error) {
    return next(error);
  }
};
