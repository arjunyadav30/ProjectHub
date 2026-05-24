const jwt = require('jsonwebtoken');
const User = require('../models/User');
const apiResponse = require('../utils/apiResponse');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    if (!token) return apiResponse.error(res, 'Not authenticated', 401);

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('-password_hash -refresh_token');
    if (!user) return apiResponse.error(res, 'User not found', 401);
    if (user.status === 'suspended' || user.status === 'inactive') {
      return apiResponse.error(res, 'Account is inactive or suspended', 403);
    }
    req.user = user;
    next();
  } catch (err) {
    return apiResponse.error(res, 'Invalid or expired token', 401);
  }
};

exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return apiResponse.error(res, `Access denied. Requires role: ${roles.join(' or ')}`, 403);
  }
  next();
};
