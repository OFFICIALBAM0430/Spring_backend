const { db } = require('../config/database');

async function getProfile(req, res) {
  try {
    const user = await db('users')
      .where({ id: req.user.id })
      .first([
        'id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'role',
        'department',
        'is_active',
        'email_verifed_at',
        'loyalty_points',
        'preferences',
        'created_at',
        'updated_at
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
      data: {
        ...user,
        email_verified: Boolean(user.email_verified_at),
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve profile',
    });
  }
}

module.exports = {
  getProfile,
};
