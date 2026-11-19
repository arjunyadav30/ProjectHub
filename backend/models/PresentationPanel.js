const mongoose = require('mongoose');

const panelSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  name: { type: String, required: true, trim: true },
  room: { type: String, default: '', trim: true },
  examiners: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' }],
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

panelSchema.index({ event_id: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('PresentationPanel', panelSchema);
