const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  module_name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['not_started', 'inprogress', 'completed'], default: 'not_started' },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  due_date: { type: Date, default: null },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  blocked_by: [{ type: mongoose.Schema.Types.ObjectId }],
  recurring: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', null], default: null },
    next_run_at: { type: Date, default: null },
  },
  template_key: { type: String, default: '' },
  estimated_hours: { type: Number, default: 0, min: 0 },
  actual_hours: { type: Number, default: 0, min: 0 },
  timer: {
    running: { type: Boolean, default: false },
    started_at: { type: Date, default: null },
    started_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true },
    parent_comment_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    created_at: { type: Date, default: Date.now },
  }],
  updated_at: { type: Date, default: Date.now },
});

const progressUpdateSchema = new mongoose.Schema({
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const projectSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  technologies_used: [{ type: String, trim: true }],
  github_link: { type: String, default: '' },
  live_link: { type: String, default: '' },
  video_link: { type: String, default: '' },
  zip_file: { type: String, default: '' },
  documentation_file: { type: String, default: '' },
  modules: [moduleSchema],
  progress_updates: [progressUpdateSchema],
  suggestions: [{
    by_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    by_name: { type: String, default: '' },
    text: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  }],
  saved_views: [{
    name: { type: String, required: true, trim: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    created_at: { type: Date, default: Date.now },
  }],
  sprint: {
    name: { type: String, default: '' },
    start_date: { type: Date, default: null },
    end_date: { type: Date, default: null },
    committed_points: { type: Number, default: 0 },
    completed_points: { type: Number, default: 0 },
  },
  github: {
    repo_full_name: { type: String, default: '' },
    repo_url: { type: String, default: '' },
    last_synced_at: { type: Date, default: null },
    open_issues: { type: Number, default: 0 },
    stars: { type: Number, default: 0 },
    forks: { type: Number, default: 0 },
    contributors_count: { type: Number, default: 0 },
    recent_commits: [{
      sha: { type: String, default: '' },
      message: { type: String, default: '' },
      author: { type: String, default: '' },
      date: { type: Date, default: null },
    }],
  },
  audit_logs: [{
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, trim: true },
    entity_type: { type: String, required: true, trim: true },
    entity_id: { type: String, required: true, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    created_at: { type: Date, default: Date.now },
  }],
  submission_status: { type: String, enum: ['not_submitted', 'submitted', 'accepted', 'rejected'], default: 'not_submitted' },
  submission_comment: { type: String, default: '' },
});

const memberSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
});

const teamSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  team_name: { type: String, required: true, trim: true },
  members: [memberSchema],
  team_leader: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  leader_accepted: { type: Boolean, default: false },
  project: { type: projectSchema, default: () => ({}) },
  assigned_faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', default: null },
  mentor_status: { type: String, enum: ['pending', 'accepted', 'rejected', 'none'], default: 'none' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  admin_registered: { type: Boolean, default: false },
  registration_status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejection_reason: { type: String, default: '' },
  video_meeting: {
    room_name: { type: String, default: '' },
    room_url: { type: String, default: '' },
    scheduled_at: { type: Date, default: null },
    last_started_at: { type: Date, default: null },
    attendance: [{
      user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      joined_at: { type: Date, default: Date.now },
    }],
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

teamSchema.virtual('progress_stats').get(function () {
  const modules = this.project?.modules || [];
  const total = modules.length;
  const completed = modules.filter(m => m.status === 'completed').length;
  const inprogress = modules.filter(m => m.status === 'inprogress').length;
  const not_started = modules.filter(m => m.status === 'not_started').length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, inprogress, not_started, percent };
});

teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Team', teamSchema);
