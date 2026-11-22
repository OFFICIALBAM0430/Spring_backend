
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../config/database');
const { jwtSecret } = require('../config/env');
const { sendEmail } = require('../utils/email');

async function register(req, res) {
  try {
    const { first_name, last_name, email, password, phone } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await db('users')
      .where({ email: normalizedEmail })
      .first();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    const [user] = await db('users')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: normalizedEmail,
        phone_number: phone || null,
        password_hash,
        verification_token: verificationToken,
        verification_expires_at: verificationExpiresAt,
      })
      .returning([
        'id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'role',
        'email_verified_at',
      ]);

    const verificationLink =
      `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your DGEP account',
      text: `Verify your email using this link: ${verificationLink}`,
      html: `
        <h2>Welcome to DGEP</h2>
        <p>Please verify your email address.</p>
        <a href="${verificationLink}">Verify Email</a>
        <p>This link expires in 24 hours.</p>
      `,
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email.',
      data: {
        user: {
          ...user,
          email_verified: false,
        },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);

    return res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await db('users')
      .where({ email: normalizedEmail })
      .first();

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated.',
      });
    }

    if (!user.email_verified_at) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone_number: user.phone_number,
          role: user.role,
          email_verified: true,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
    });
  }
}

async function verifyEmail(req, res) {
  try {
    const { token } = req.body;

    const user = await db('users')
      .where({ verification_token: token })
      .where('verification_expires_at', '>', new Date())
      .first();

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    await db('users')
      .where({ id: user.id })
      .update({
        email_verified_at: new Date(),
        verification_token: null,
        verification_expires_at: null,
      });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Email verification error:', error);

    return res.status(500).json({
      success: false,
      message: 'Email verification failed',
    });
  }
}



async function resendVerification(req, res) {
  try {
    const normalizedEmail = req.body.email.trim().toLowerCase();

    const user = await db('users')
      .where({ email: normalizedEmail })
      .first();

    // Always return the same response for privacy.
    const response = {
      success: true,
      message:
        'If the account exists and is unverified, a new verification email will be sent.',
    };

    if (!user || user.email_verified_at || !user.is_active) {
      return res.status(200).json(response);
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');

    const verificationExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    await db('users')
      .where({ id: user.id })
      .update({
        verification_token: verificationToken,
        verification_expires_at: verificationExpiresAt,
      });

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      throw new Error('FRONTEND_URL is not configured');
    }

    const verificationLink =
      `${frontendUrl.replace(/\/+$/, '')}/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your DGEP account',
      text: `Verify your email using this link: ${verificationLink}`,
      html: `
        <h2>Verify your DGEP account</h2>
        <p>Please verify your email address.</p>
        <a href="${verificationLink}">Verify Email</a>
        <p>This link expires in 24 hours.</p>
      `,
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error('Resend verification error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to process verification request. Please try again.',
    });
  }
}


async function forgotPassword(req, res) {
  try {
    const normalizedEmail = req.body.email.trim().toLowerCase();

    const user = await db('users')
      .where({ email: normalizedEmail })
      .first();

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');

      const resetTokenHash = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      const resetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db('users')
        .where({ id: user.id })
        .update({
          password_reset_token_hash: resetTokenHash,
          password_reset_expires_at: resetExpiresAt,
        });

      const resetLink =
        `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      await sendEmail({
        to: normalizedEmail,
        subject: 'Reset your DGEP password',
        text: `Reset your password using this link: ${resetLink}`,
        html: `
          <h2>Password Reset</h2>
          <p>You requested to reset your DGEP password.</p>
          <a href="${resetLink}">Reset Password</a>
          <p>This link expires in 15 minutes.</p>
        `,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'If the email is registered, a reset link will be sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to process password reset request',
    });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    const resetTokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await db('users')
      .where({ password_reset_token_hash: resetTokenHash })
      .where('password_reset_expires_at', '>', new Date())
      .first();

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid, expired, or already used',
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await db('users')
      .where({ id: user.id })
      .update({
        password_hash,
        password_reset_token_hash: null,
        password_reset_expires_at: null,
      });

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now log in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);

    return res.status(500).json({
      success: false,
      message: 'Password reset failed. Please try again.',
    });
  }
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
