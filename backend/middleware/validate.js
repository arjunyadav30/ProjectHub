const { validationResult } = require('express-validator');
const apiResponse = require('../utils/apiResponse');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return apiResponse.error(res, 'Validation failed', 400, errors.array().map(e => e.msg));
  }
  next();
};

module.exports = { validateRequest };
