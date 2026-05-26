const Team = require('../models/Team');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const apiResponse = require('../utils/apiResponse');

exports.getAdvancedAnalytics = async (req, res, next) => {
  try {
    const teams = await Team.find({ college_id: req.user.college_id }).populate('event_id', 'department title').lean();
    const facultyCount = await Faculty.countDocuments({ status: 'active', college_id: req.user.college_id });
    const studentCount = await Student.countDocuments({ status: 'active', college_id: req.user.college_id });

    const completion = teams.map((team) => {
      const modules = team.project?.modules || [];
      const done = modules.filter((m) => m.status === 'completed').length;
      return { team_id: team._id, team_name: team.team_name, completion: modules.length ? Math.round((done / modules.length) * 100) : 0 };
    });

    const facultyPerformance = teams.reduce((acc, team) => {
      const key = String(team.assigned_faculty || 'unassigned');
      if (!acc[key]) acc[key] = { faculty_id: key, teams: 0, approved: 0 };
      acc[key].teams += 1;
      if (team.registration_status === 'approved') acc[key].approved += 1;
      return acc;
    }, {});

    const deptMap = teams.reduce((acc, team) => {
      const dept = team.event_id?.department || 'Unknown';
      if (!acc[dept]) acc[dept] = { department: dept, total_teams: 0, avg_completion: 0, _sum: 0 };
      const c = completion.find((item) => String(item.team_id) === String(team._id))?.completion || 0;
      acc[dept].total_teams += 1;
      acc[dept]._sum += c;
      acc[dept].avg_completion = Math.round(acc[dept]._sum / acc[dept].total_teams);
      return acc;
    }, {});

    return apiResponse.success(res, {
      summary: {
        total_teams: teams.length,
        active_students: studentCount,
        active_faculty: facultyCount,
      },
      project_completion: completion,
      faculty_performance: Object.values(facultyPerformance),
      student_activity: {
        active_students: studentCount,
        team_participation_rate: studentCount ? Number(((teams.length / studentCount) * 100).toFixed(2)) : 0,
      },
      department_wise: Object.values(deptMap).map(({ _sum, ...rest }) => rest),
    });
  } catch (error) { return next(error); }
};
