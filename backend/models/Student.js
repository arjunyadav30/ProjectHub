const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  enrollment_no: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true },
  github_link: { type: String, default: '' },
  linkedin_link: { type: String, default: '' },
  phone: { type: String, default: '' },
  skills: [{ type: String, trim: true }],
  branch: { type: String, enum: ['CSE', 'IT', 'ECE', 'ME', 'CE', 'EE', ''], default: '' },
  semester: { type: Number, min: 1, max: 8, default: null },
  year: { type: Number, min: 1, max: 4, default: null },
  session: { type: String, default: '' }, // e.g. "2021-25"
  dob: { type: Date, default: null },
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
  address: { type: String, default: '' },
  guardian_name: { type: String, default: '' },
  guardian_phone: { type: String, default: '' },
  profile_image: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive', 'alumni', 'dropout'], default: 'active' },
  is_profile_complete: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Student', studentSchema);
