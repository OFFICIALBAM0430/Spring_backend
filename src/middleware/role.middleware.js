function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

  
    const roleAliases = {
      admin: 'administrator',
      staff: 'service_staff',
    };

    const userRole = roleAliases[req.user.role] || req.user.role;

    const permittedRoles = allowedRoles.map(
      (role) => roleAliases[role] || role,
    );

    if (!permittedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }

    return next();
  };
}

module.exports = requireRole;
