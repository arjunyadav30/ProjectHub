const mongoose = require('mongoose');

const scoreBreakupSchema = new mongoose.Schema({
  innovation: { type: Number, required: true, min: 0, max: 10 },
  execution: { type: Number, required: true, min: 0, max: 10 },
  ui_ux: { type: Number, required: true, min: 0, max: 10 },
  impact: { type: Number, required: true, min: 0, max: 10 },
}, { _id: false });

const hackathonScoreSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  hackathon_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Hackathon', required: true, index: true },
  submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HackathonSubmission', required: true, index: true },
  judge_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },
  scores: { type: scoreBreakupSchema, required: true },
  total: { type: Number, default: 0, min: 0, max: 40 },
  comment: { type: String, default: '' },
}, { timestamps: true });

hackathonScoreSchema.index({ submission_id: 1, judge_id: 1 }, { unique: true });

hackathonScoreSchema.pre('save', function scorePreSave(next) {
  if (this.scores) {
    this.total = (Number(this.scores.innovation) || 0)
      + (Number(this.scores.execution) || 0)
      + (Number(this.scores.ui_ux) || 0)
      + (Number(this.scores.impact) || 0);
  }
  next();
});

module.exports = mongoose.model('HackathonScore', hackathonScoreSchema);
