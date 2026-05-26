const mongoose = require('mongoose');

const presentationLabelSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  marks_out_of: { type: Number, required: true, min: 1, default: 100 },
}, { _id: true });

const presentationScheduleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  due_date: { type: Date, required: true },
  labels: [presentationLabelSchema],
}, { _id: true, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const eventSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  allowed_semesters: [{ type: Number, enum: [1, 2, 3, 4, 5, 6, 7, 8] }],
  allowed_years: [{ type: Number, enum: [1, 2, 3, 4] }],
  allowed_branches: [{ type: String, enum: ['CSE', 'IT', 'ECE', 'ME', 'CE', 'EE'] }],
  min_team_size: { type: Number, default: 1 },
  max_team_size: { type: Number, default: 4 },
  registration_start: { type: Date, default: Date.now },
  registration_end: { type: Date, required: true },
  event_end_date: { type: Date, required: true },
  status: { type: String, enum: ['upcoming', 'active', 'closed', 'draft', 'open', 'completed'], default: 'active' },
  presentation_schedule: {
    start_date: { type: Date },
    end_date: { type: Date },
    marks_out_of: { type: Number, default: 100 },
    marks_label: { type: String, default: 'Presentation' },
  },
  presentation_schedules: [presentationScheduleSchema],
  featured_projects: [{
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    deployed_link: { type: String, default: '' },
    title: { type: String, default: '' },
  }],
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

eventSchema.methods.updateStatus = function () {
  const now = new Date();
  if (now > this.event_end_date) this.status = 'closed';
  else if (now > this.registration_end) this.status = 'active';
  else if (now >= this.registration_start) this.status = 'active';
  else this.status = 'upcoming';
};

eventSchema.index({ college_id: 1 });
module.exports = mongoose.model('Event', eventSchema);
