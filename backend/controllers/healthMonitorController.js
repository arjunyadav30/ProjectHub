const Event = require('../models/Event');
const Team = require('../models/Team');
const HealthCheckLog = require('../models/HealthCheckLog');
const apiResponse = require('../utils/apiResponse');
const { getTeamAccess } = require('../utils/teamAccess');
const { checkTeamHealth, loadForCheck } = require('../jobs/healthMonitor');

const COOLDOWN_MS = 60 * 1000;
const DAY = 24 * 3600 * 1000;

const uptimeFor = async (match, days = 7) => {
  const rows = await HealthCheckLog.aggregate([
    { $match: { ...match, checked_at: { $gte: new Date(Date.now() - days * DAY) } } },
    { $group: { _id: '$team_id', total: { $sum: 1 }, ok: { $sum: { $cond: [{ $ne: ['$status', 'down'] }, 1, 0] } }, avg_ms: { $avg: '$response_ms' } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), { uptime_percent: Number(((r.ok / r.total) * 100).toFixed(1)), avg_response_ms: Math.round(r.avg_ms), checks: r.total }]));
};

exports.getEventHealth = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select('college_id');
    if (!event || event.college_id.toString() !== req.user.college_id?.toString()) return apiResponse.error(res, 'Event not found', 404);
    const teams = await Team.find({ event_id: event._id, college_id: req.user.college_id, registration_status: 'approved' }).select('team_name project.title project.live_link project.health');
    const stats = await uptimeFor({ team_id: { $in: teams.map((t) => t._id) } });
    const rows = teams.map((t) => ({
      team_id: t._id, team_name: t.team_name, project_title: t.project?.title || '', live_link: t.project?.live_link || '',
      status: t.project?.live_link ? (t.project?.health?.status || 'unknown') : 'no_link',
      last_checked_at: t.project?.health?.last_checked_at || null, last_response_ms: t.project?.health?.last_response_ms || 0, last_error: t.project?.health?.last_error || '',
      ...(stats.get(t._id.toString()) || { uptime_percent: null, avg_response_ms: null, checks: 0 }),
    }));
    const summary = ['up', 'slow', 'down', 'unknown', 'no_link'].reduce((a, k) => ({ ...a, [k]: rows.filter((r) => r.status === k).length }), {});
    return apiResponse.success(res, { summary, rows });
  } catch (e) { return next(e); }
};

exports.getTeamHealth = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId).select('college_id members assigned_faculty mentor_status team_name project.live_link project.health');
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    const a = await getTeamAccess(req.user, team);
    if (!a.isAdmin && !a.isMentor && !a.isMember) return apiResponse.error(res, 'Not allowed', 403);
    const [history, stats] = await Promise.all([
      HealthCheckLog.find({ team_id: team._id }).sort({ checked_at: -1 }).limit(100).select('status response_ms http_status error checked_at'),
      uptimeFor({ team_id: team._id }, 30),
    ]);
    const week = await uptimeFor({ team_id: team._id }, 7);
    return apiResponse.success(res, { team_name: team.team_name, live_link: team.project?.live_link || '', health: team.project?.health || {}, uptime_7d: week.get(team._id.toString()) || null, uptime_30d: stats.get(team._id.toString()) || null, history });
  } catch (e) { return next(e); }
};

exports.checkNow = async (req, res, next) => {
  try {
    const [team] = await loadForCheck({ _id: req.params.teamId });
    if (!team) return apiResponse.error(res, 'No live link to check for this team', 404);
    const a = await getTeamAccess(req.user, team);
    if (!a.isAdmin && !a.isMentor && !a.isMember) return apiResponse.error(res, 'Not allowed', 403);
    const last = team.project?.health?.last_checked_at;
    if (last && Date.now() - new Date(last).getTime() < COOLDOWN_MS) return apiResponse.error(res, 'Checked less than a minute ago', 429);
    const result = await checkTeamHealth(team);
    return apiResponse.success(res, result, 'Check complete');
  } catch (e) { return next(e); }
};
