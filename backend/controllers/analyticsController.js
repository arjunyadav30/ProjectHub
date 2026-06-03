const Team = require('../models/Team');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const apiResponse = require('../utils/apiResponse');

const getProgress = (team) => {
  const modules = team.project?.modules || [];
  const completed = modules.filter((m) => m.status === 'completed').length;
  const percent = modules.length ? Math.round((completed / modules.length) * 100) : 0;
  return { total: modules.length, completed, percent };
};

const getGithubStreak = (team) => {
  const commits = team.project?.github?.recent_commits || [];
  const days = new Set(
    commits
      .map((commit) => commit.date ? new Date(commit.date).toISOString().slice(0, 10) : null)
      .filter(Boolean)
  );
  return days.size;
};

const getSubmissionBonus = (status) => {
  if (status === 'accepted') return 20;
  if (status === 'submitted') return 12;
  if (status === 'rejected') return 5;
  return 0;
};

const buildGamification = (teams) => {
  const studentBadges = new Map();
  const addBadge = (student, badge) => {
    if (!student?._id) return;
    const key = String(student._id);
    if (!studentBadges.has(key)) {
      studentBadges.set(key, {
        student_id: key,
        name: student.name,
        enrollment_no: student.enrollment_no,
        badges: [],
        points: 0,
      });
    }
    const record = studentBadges.get(key);
    if (!record.badges.some((item) => item.key === badge.key)) {
      record.badges.push(badge);
      record.points += badge.points;
    }
  };

  const leaderboard = teams.map((team) => {
    const progress = getProgress(team);
    const submissionStatus = team.project?.submission_status || 'not_submitted';
    const githubStreak = getGithubStreak(team);
    const acceptedMembers = (team.members || []).filter((member) => member.status === 'accepted');
    const score = Math.round(
      (progress.percent * 0.6) +
      getSubmissionBonus(submissionStatus) +
      Math.min(10, githubStreak * 2) +
      Math.min(10, progress.total)
    );

    const teamBadges = [];
    if (submissionStatus !== 'not_submitted') {
      teamBadges.push({ key: 'first_submission', label: 'First Submission', points: 20 });
    }
    if (progress.total > 0 && progress.percent === 100) {
      teamBadges.push({ key: 'module_master', label: '100% Modules', points: 30 });
    }
    if (githubStreak >= 3) {
      teamBadges.push({ key: 'github_streak', label: 'GitHub Streak', points: 15 });
    }

    acceptedMembers.forEach((member) => {
      teamBadges.forEach((badge) => addBadge(member.student_id, badge));
    });

    return {
      team_id: team._id,
      team_name: team.team_name,
      event_title: team.event_id?.title || '',
      score,
      progress,
      submission_status: submissionStatus,
      github_streak_days: githubStreak,
      badges: teamBadges,
      members: acceptedMembers.map((member) => ({
        student_id: member.student_id?._id,
        name: member.student_id?.name,
        enrollment_no: member.student_id?.enrollment_no,
      })),
    };
  }).sort((a, b) => b.score - a.score);

  const badgeCounts = leaderboard.reduce((acc, team) => {
    team.badges.forEach((badge) => {
      acc[badge.key] = acc[badge.key] || { key: badge.key, label: badge.label, count: 0 };
      acc[badge.key].count += 1;
    });
    return acc;
  }, {});

  return {
    leaderboard: leaderboard.slice(0, 10),
    trophy_wall: leaderboard.slice(0, 3),
    badge_counts: Object.values(badgeCounts),
    student_achievements: [...studentBadges.values()]
      .sort((a, b) => b.points - a.points)
      .slice(0, 12),
  };
};

exports.getAdvancedAnalytics = async (req, res, next) => {
  try {
    const teams = await Team.find({ college_id: req.user.college_id })
      .populate('event_id', 'department title')
      .populate('members.student_id', 'name enrollment_no')
      .lean();
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
      gamification: buildGamification(teams),
    });
  } catch (error) { return next(error); }
};

exports.getGamification = async (req, res, next) => {
  try {
    const teams = await Team.find({ college_id: req.user.college_id })
      .populate('event_id', 'title')
      .populate('members.student_id', 'name enrollment_no')
      .lean();

    return apiResponse.success(res, buildGamification(teams));
  } catch (error) { return next(error); }
};
