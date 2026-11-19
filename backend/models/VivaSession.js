const mongoose = require('mongoose');

const vivaQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  expected_points: [{ type: String }],
  answer: { type: String, default: '' },
  score: { type: Number, default: 0 },
  feedback: { type: String, default: '' },
  commit_sha: { type: String, default: '' },
  commit_message: { type: String, default: '' },
  files: [{ type: String }],
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  context_excerpt: { type: String, default: '' },
}, { _id: false });

const vivaSessionSchema = new mongoose.Schema({
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  student_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project_title: { type: String, default: '' },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  questions: [vivaQuestionSchema],
  source: { type: String, enum: ['rule', 'commit_ai'], default: 'rule' },
  generation_method: { type: String, enum: ['template', 'ai', 'fallback'], default: 'template' },
  scoring_method: { type: String, enum: ['heuristic', 'ai', 'ai_fallback'], default: 'heuristic' },
  trust: {
    git_score_100: { type: Number, default: null },
    viva_score_100: { type: Number, default: null },
    level: { type: String, default: '' },
    gap: { type: Number, default: null },
    message: { type: String, default: '' },
  },
  total_score: { type: Number, default: 0 },
  max_score: { type: Number, default: 100 },
  overall_feedback: { type: String, default: '' },
  faculty_review: {
    reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    comment: { type: String, default: '' },
    reviewed_at: { type: Date, default: null },
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('VivaSession', vivaSessionSchema);
