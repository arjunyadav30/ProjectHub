const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  report_type: { type: String, default: 'minor_project', index: true },
  title: { type: String, default: 'Minor Project Report' },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

reportSchema.index({ user_id: 1, report_type: 1 }, { unique: true });

module.exports = mongoose.model('StudentReport', reportSchema);
