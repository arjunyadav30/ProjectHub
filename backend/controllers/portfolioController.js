const Student = require('../models/Student');
const Team = require('../models/Team');
const User = require('../models/User');
const apiResponse = require('../utils/apiResponse');

const buildPortfolioHtml = ({ student, user, teams }) => {
  const skills = (student.skills || []).map((s) => `<span style="display:inline-block;background:#e7f0ff;color:#174ea6;padding:6px 10px;border-radius:999px;margin:4px;font-size:12px;">${s}</span>`).join('');
  const projects = teams.map((team) => `
    <div style="border:1px solid #dfe3ea;border-radius:12px;padding:14px;margin-bottom:10px;">
      <h3 style="margin:0 0 6px 0;">${team.project?.title || team.team_name}</h3>
      <p style="margin:0 0 8px 0;color:#555;">${team.project?.description || 'No description provided.'}</p>
      <p style="margin:0;font-size:12px;color:#6b7280;">Tech: ${(team.project?.technologies_used || []).join(', ') || 'N/A'}</p>
    </div>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${student.name} Portfolio</title></head>
  <body style="font-family:Segoe UI,Arial,sans-serif;background:#f5f7fb;padding:24px;color:#111;">
    <div style="max-width:900px;margin:0 auto;background:white;border-radius:18px;padding:24px;border:1px solid #e5e7eb;">
      <h1 style="margin:0;">${student.name}</h1>
      <p style="color:#4b5563;">${user.email} | ${student.branch} | Year ${student.year || '-'} </p>
      <h2 style="margin-top:24px;">Skills</h2>
      <div>${skills || '<p>No skills added</p>'}</div>
      <h2 style="margin-top:24px;">Projects</h2>
      ${projects || '<p>No projects available</p>'}
    </div>
  </body></html>`;
};

exports.getResumeData = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) return apiResponse.error(res, 'Student profile not found', 404);

    const user = await User.findById(req.user._id).select('name email');
    const teams = await Team.find({ 'members.student_id': student._id, 'members.status': 'accepted' })
      .select('team_name project.title project.description project.technologies_used project.github_link project.live_link');

    const resume = {
      name: student.name,
      email: user.email,
      phone: student.phone || '',
      branch: student.branch,
      year: student.year,
      skills: student.skills || [],
      projects: teams.map((team) => ({
        title: team.project?.title || team.team_name,
        description: team.project?.description || '',
        technologies: team.project?.technologies_used || [],
        github_link: team.project?.github_link || '',
        live_link: team.project?.live_link || '',
      })),
    };

    const portfolio_html = buildPortfolioHtml({ student, user, teams });

    return apiResponse.success(res, { resume, portfolio_html });
  } catch (error) { return next(error); }
};

exports.downloadPortfolioHtml = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) return apiResponse.error(res, 'Student profile not found', 404);
    const user = await User.findById(req.user._id).select('name email');
    const teams = await Team.find({ 'members.student_id': student._id, 'members.status': 'accepted' })
      .select('team_name project.title project.description project.technologies_used');

    const html = buildPortfolioHtml({ student, user, teams });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"${student.name.replace(/\s+/g, '_')}_portfolio.html\"`);
    return res.send(html);
  } catch (error) { return next(error); }
};
