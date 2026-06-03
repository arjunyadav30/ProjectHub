const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  issued_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  issued_at: { type: Date, default: Date.now },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  file_url: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);
