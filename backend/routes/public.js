const express = require('express');
const router = express.Router();
const WebsiteConfig = require('../models/WebsiteConfig');
const Team = require('../models/Team');
const apiResponse = require('../utils/apiResponse');

// GET /api/public/website-config
router.get('/website-config', async (req, res) => {
  try {
    let config = await WebsiteConfig.findOne();
    if (!config) config = { site_name: 'ProjectHub', logo_url: '', hero_image_url: '', featured_projects: [] };
    return apiResponse.success(res, config);
  } catch (e) {
    return apiResponse.success(res, { site_name: 'ProjectHub', logo_url: '', hero_image_url: '', featured_projects: [] });
  }
});

// GET /api/public/featured-projects
router.get('/featured-projects', async (req, res) => {
  try {
    const config = await WebsiteConfig.findOne();
    if (!config || !config.featured_projects?.length) return apiResponse.success(res, []);

    const teamIds = config.featured_projects.map(fp => fp.project_id);
    const teams = await Team.find({ _id: { $in: teamIds } })
      .populate('members.student_id', 'name profile_image enrollment_no')
      .populate('assigned_faculty', 'name profile_image')
      .populate('event_id', 'title');

    const result = config.featured_projects.map(fp => {
      const team = teams.find(t => t._id.toString() === fp.project_id?.toString());
      return { ...fp.toObject(), team };
    }).filter(fp => fp.team);

    return apiResponse.success(res, result);
  } catch (e) {
    return apiResponse.success(res, []);
  }
});

module.exports = router;
