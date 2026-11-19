const mongoose = require('mongoose');

const memberRowSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  name: { type: String, default: '' },
  github_login: { type: String, default: '' },
  commits: { type: Number, default: 0 },
  effective_lines: { type: Number, default: 0 },
  active_days: { type: Number, default: 0 },
  pull_requests: { type: Number, default: 0 },
  message_quality: { type: Number, default: 0 },
  share_percent: { type: Number, default: 0 },
  equal_share_percent: { type: Number, default: 0 },
  suggested_score_100: { type: Number, default: 0 },
  flags: [{ type: String }],
}, { _id: false });

const contributionReportSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  generated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  repo_full_name: { type: String, default: '' },
  window: { since: { type: Date, default: null }, until: { type: Date, default: null } },
  weights_used: { type: mongoose.Schema.Types.Mixed, default: {} },
  fetched_commits: { type: Number, default: 0 },
  analyzed_commits: { type: Number, default: 0 },
  detail_commits_fetched: { type: Number, default: 0 },
  truncated: { type: Boolean, default: false },
  notes: [{ type: String }],
  members: [memberRowSchema],
  unmapped_authors: [{ login: String, email: String, name: String, commits: Number, _id: false }],
  // The guide's final call. Suggestions never replace this.
  guide_decision: {
    scores: [{ student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, score_100: { type: Number, min: 0, max: 100 }, _id: false }],
    comment: { type: String, default: '' },
    decided_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decided_at: { type: Date, default: null },
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

contributionReportSchema.index({ team_id: 1, created_at: -1 });

module.exports = mongoose.model('ContributionReport', contributionReportSchema);
