
const { db } = require('../config/database');

async function getProfile(req, res, next) {
  try {
    const user = await db('users').where({ id: req.user.id }).first([
      'id', 'first_name', 'last_name', 'email', 'phone_number', 'role',
      'is_active', 'email_verified_at', 'created_at', 'updated_at',
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile fetched successfully',
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getProfile };
