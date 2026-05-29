const mongoose = require('mongoose');

const hackathonSubmissionSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  hackathon_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Hackathon', required: true, index: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  project_title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  github_link: { type: String, default: '' },
  demo_video_url: { type: String, default: '' },
  tech_stack: [{ type: String, trim: true }],
  file_url: { type: String, default: '' },
  submitted_at: { type: Date, default: Date.now },
}, { timestamps: true });

hackathonSubmissionSchema.index({ hackathon_id: 1, team_id: 1 }, { unique: true });

module.exports = mongoose.model('HackathonSubmission', hackathonSubmissionSchema);
