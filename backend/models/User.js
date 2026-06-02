const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: false, default: null, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  auth_scope: { type: String, enum: ['projecthub'], required: true, default: 'projecthub', index: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['student', 'faculty', 'admin'], required: true },
  phone: { type: String, default: '' },
  profile_image: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  is_verified: { type: Boolean, default: false }, // student 2-step complete
  email_verified: { type: Boolean, default: false },
  email_verification_token: { type: String },
  email_verification_expires: { type: Date },
  password_changed_at: { type: Date }, // for students forced pw change
  reset_password_token: { type: String },
  reset_password_expires: { type: Date },
  // legacy fields
  password_reset_token: { type: String },
  password_reset_expires: { type: Date },
  refresh_token: { type: String },
  last_login: { type: Date },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

userSchema.index({ email: 1, auth_scope: 1 }, { unique: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) return next();
  this.password_hash = await bcrypt.hash(this.password_hash, 10);
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password_hash);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password_hash;
  delete obj.refresh_token;
  delete obj.email_verification_token;
  delete obj.password_reset_token;
  delete obj.reset_password_token;
  return obj;
};

module.exports = mongoose.model('User', userSchema);

