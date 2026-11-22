const Joi = require('joi');

const registerSchema = Joi.object({
  first_name: Joi.string().trim().min(2).required(),
  last_name: Joi.string().trim().min(2).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string().trim().allow(''),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required(),
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

const resendVerificationSchema = Joi.object({
  email: Joi.string().trim().email().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
});


module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
