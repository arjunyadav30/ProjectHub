const mongoose = require('mongoose');

const prizeSchema = new mongoose.Schema({
  rank: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, default: 0, min: 0 },
}, { _id: false });

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  answer: { type: String, required: true, trim: true },
}, { _id: false });

const hackathonSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  banner_image_url: { type: String, default: '' },
  registration_start: { type: Date, required: true },
  registration_end: { type: Date, required: true },
  submission_deadline: { type: Date, required: true },
  max_team_size: { type: Number, default: 4, min: 1 },
  tracks: [{ type: String, trim: true }],
  prizes: [prizeSchema],
  rules: { type: String, default: '' },
  faqs: [faqSchema],
  judges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' }],
  registered_teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  status: {
    type: String,
    enum: ['draft', 'upcoming', 'ongoing', 'ended'],
    default: 'draft',
  },
  is_results_published: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Hackathon', hackathonSchema);
