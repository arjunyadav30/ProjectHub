const mongoose = require('mongoose');

const finalGradeSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  // Faculty-entered inputs (not derivable from other modules)
  manual: {
    report_score: { type: Number, min: 0, max: 100, default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  // Snapshot written by "finalize"
  locked: { type: Boolean, default: false },
  components: { type: mongoose.Schema.Types.Mixed, default: null },
  breakdown: { type: mongoose.Schema.Types.Mixed, default: null },
  weights_used: { type: mongoose.Schema.Types.Mixed, default: null },
  computed_score: { type: Number, default: null },
  partial: { type: Boolean, default: false },
  override: {
    score: { type: Number, min: 0, max: 100, default: null },
    reason: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  finalized_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  finalized_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

finalGradeSchema.index({ event_id: 1, student_id: 1 }, { unique: true });

module.exports = mongoose.model('FinalGrade', finalGradeSchema);
