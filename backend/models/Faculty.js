const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  faculty_id: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true },
  phone: { type: String, default: '' },
  department: { type: String, default: '' },
  designation: { type: String, default: '' },
  qualification: { type: String, default: '' },
  github_link: { type: String, default: '' },
  linkedin_link: { type: String, default: '' },
  experience_years: { type: Number, default: 0 },
  subjects: [{ type: String, trim: true }],
  profile_image: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Faculty', facultySchema);

facultySchema.index({ college_id: 1 });
