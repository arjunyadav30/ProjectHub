const mongoose = require('mongoose');

const awardSchema = new mongoose.Schema({
  badge_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  awarded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: 'awarded_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Award', awardSchema);
