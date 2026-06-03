const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, unique: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '' },
  auto_award_event: { type: String, default: '' }, // optional event key
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Badge', badgeSchema);
