const mongoose = require('mongoose');

const websiteConfigSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  logo_url: { type: String, default: '' },
  hero_image_url: { type: String, default: '' },
  site_name: { type: String, default: 'ProjectHub' },
  featured_projects: [{
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    deployed_link: { type: String, default: '' },
    title: { type: String, default: '' },
  }],
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('WebsiteConfig', websiteConfigSchema);

websiteConfigSchema.index({ college_id: 1 }, { unique: true });
