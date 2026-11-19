const mongoose = require('mongoose');

const judgeScoreSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  presentation_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  slot_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PresentationSlot', required: true },
  panel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PresentationPanel', required: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  examiner_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  criteria: [{
    label_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    label: { type: String, required: true },
    marks: { type: Number, required: true, min: 0 },
    marks_out_of: { type: Number, required: true, min: 1 },
    _id: false,
  }],
  total_percent: { type: Number, min: 0, max: 100, required: true },
  comment: { type: String, default: '' },
  submitted_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

judgeScoreSchema.index({ presentation_id: 1, team_id: 1, examiner_user_id: 1 }, { unique: true });
judgeScoreSchema.index({ event_id: 1, presentation_id: 1 });

module.exports = mongoose.model('JudgeScore', judgeScoreSchema);
