const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employee_id: { type: String, default: '' },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true },
  phone: { type: String, default: '' },
  department: { type: String, default: '' },
  permissions: [{ type: String }],
  profile_image: { type: String, default: '' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Admin', adminSchema);

adminSchema.index({ college_id: 1 });
