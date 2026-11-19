const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  presentation_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  panel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PresentationPanel', required: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  start_at: { type: Date, required: true },
  end_at: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled' },
  published: { type: Boolean, default: false },
  scores_locked: { type: Boolean, default: false },
  // Live timer (set by the panel chair)
  started_at: { type: Date, default: null },
  ended_at: { type: Date, default: null },
  reschedule_request: {
    status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: '' },
    preferred_start: { type: Date, default: null },
    decided_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decision_note: { type: String, default: '' },
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

slotSchema.index({ event_id: 1, presentation_id: 1, team_id: 1 }, { unique: true });
slotSchema.index({ panel_id: 1, start_at: 1 });

module.exports = mongoose.model('PresentationSlot', slotSchema);
