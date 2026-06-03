const Certificate = require('../models/Certificate');
const User = require('../models/User');
const apiResponse = require('../utils/apiResponse');

const createCertificate = async (req, res, next) => {
  try {
    const { user_id, title, description, file_url, meta } = req.body;
    if (!user_id || !title) return apiResponse.error(res, 'user_id and title required', 400);
    const user = await User.findById(user_id);
    if (!user) return apiResponse.error(res, 'User not found', 404);
    const cert = await Certificate.create({ user_id, issued_by: req.user._id, title, description, file_url, meta });
    return apiResponse.created(res, cert, 'Certificate recorded');
  } catch (err) { next(err); }
};

const getUserCertificates = async (req, res, next) => {
  try {
    const userId = req.params.id || req.user._id;
    const certs = await Certificate.find({ user_id: userId }).sort({ issued_at: -1 });
    return apiResponse.success(res, certs);
  } catch (err) { next(err); }
};

const getCertificate = async (req, res, next) => {
  try {
    const cert = await Certificate.findById(req.params.id);
    if (!cert) return apiResponse.error(res, 'Certificate not found', 404);
    return apiResponse.success(res, cert);
  } catch (err) { next(err); }
};

module.exports = { createCertificate, getUserCertificates, getCertificate };
