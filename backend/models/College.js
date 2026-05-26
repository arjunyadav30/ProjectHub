const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  logo: { type: String, default: '' },
  address: { type: String, default: '' },
  subscription_status: { type: String, enum: ['active', 'trial', 'expired'], default: 'trial' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('College', collegeSchema);
