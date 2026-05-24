const apiResponse = require('../utils/apiResponse');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return apiResponse.error(res, 'Validation failed', 400, errors);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return apiResponse.error(res, `${field} already exists`, 409);
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    return apiResponse.error(res, 'Invalid ID format', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return apiResponse.error(res, 'Invalid token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return apiResponse.error(res, 'Token expired', 401);
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return apiResponse.error(res, 'File too large. Max 5MB allowed.', 400);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  return apiResponse.error(res, message, statusCode);
};

module.exports = { errorHandler };
