const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  presentation_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  presentation_title: { type: String, default: '' },
  label_marks: [{
    label_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    label: { type: String, required: true },
    marks: { type: Number, default: 0 },
    marks_out_of: { type: Number, default: 100 },
  }],
  presentation_marks: { type: Number, default: 0 },
  marks_out_of: { type: Number, default: 100 },
  marks_label: { type: String, default: 'Presentation' },
  attendance: { type: String, enum: ['present', 'absent', 'not_marked'], default: 'not_marked' },
  awarded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

marksSchema.index({ event_id: 1, team_id: 1, student_id: 1, presentation_id: 1 }, { unique: true });

module.exports = mongoose.model('Marks', marksSchema);
