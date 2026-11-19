const Team = require('../models/Team');
const HealthCheckLog = require('../models/HealthCheckLog');
const { checkUrl } = require('../utils/healthCheck');
const { createNotifications } = require('../utils/notifications');
const { mapWithConcurrency } = require('../utils/githubClient');

const FAILURES_BEFORE_DOWN = 2; // avoids false alarms from one blip
let running = false;
let timer = null;

const teamRecipients = (team) => {
  const ids = new Set();
  (team.members || []).filter((m) => m.status === 'accepted').forEach((m) => m.student_id?.user_id && ids.add(m.student_id.user_id.toString()));
  if (team.assigned_faculty?.user_id) ids.add(team.assigned_faculty.user_id.toString());
  return [...ids];
};

/** Checks one team's live link, stores history, updates status and alerts on transitions. */
const checkTeamHealth = async (team) => {
  const url = team.project?.live_link;
  if (!url) return null;
  const prev = team.project?.health || {};
  const sameUrl = prev.checked_url === url;
  const res = await checkUrl(url);

  const failures = res.ok ? 0 : (sameUrl ? (prev.consecutive_failures || 0) : 0) + 1;
  const prevStatus = sameUrl ? (prev.status || 'unknown') : 'unknown';
  let status;
  if (res.ok) status = res.status;
  else status = failures >= FAILURES_BEFORE_DOWN ? 'down' : (prevStatus === 'unknown' ? 'unknown' : prevStatus);

  await HealthCheckLog.create({ college_id: team.college_id, team_id: team._id, url, status: res.status, http_status: res.http_status, response_ms: res.response_ms, error: res.error });

  const changed = status !== prevStatus;
  const alertAlreadySent = sameUrl && !!prev.down_alert_sent;
  const update = {
    'project.health.status': status,
    'project.health.last_checked_at': new Date(),
    'project.health.last_response_ms': res.response_ms,
    'project.health.last_http_status': res.http_status,
    'project.health.last_error': res.error,
    'project.health.consecutive_failures': failures,
    'project.health.checked_url': url,
    ...(changed ? { 'project.health.last_status_change_at': new Date() } : {}),
  };

  const notes = [];
  const title = team.team_name;
  if (status === 'down' && !alertAlreadySent) {
    update['project.health.down_alert_sent'] = true;
    teamRecipients(team).forEach((r) => notes.push({ recipient: r, type: 'health_alert', title: 'Live link is down', message: `${title}: your deployed project is not reachable (${res.error || 'no response'})`, reference_id: team._id, reference_type: 'Team' }));
  } else if (alertAlreadySent && (status === 'up' || status === 'slow')) {
    update['project.health.down_alert_sent'] = false;
    teamRecipients(team).forEach((r) => notes.push({ recipient: r, type: 'health_recovered', title: 'Live link recovered', message: `${title}: your deployed project is reachable again`, reference_id: team._id, reference_type: 'Team' }));
  }
  await Team.updateOne({ _id: team._id }, { $set: update });
  if (notes.length) await createNotifications(notes);
  return { status, ...res };
};

const loadForCheck = (filter) => Team.find({ 'project.live_link': { $nin: ['', null] }, registration_status: 'approved', ...filter })
  .select('college_id team_name members assigned_faculty mentor_status project.live_link project.health')
  .populate('members.student_id', 'user_id')
  .populate('assigned_faculty', 'user_id');

const runHealthChecks = async () => {
  if (running) return { skipped: true };
  running = true;
  try {
    const teams = await loadForCheck({}).limit(500);
    const out = await mapWithConcurrency(teams, 5, (t) => checkTeamHealth(t));
    return { checked: out.filter((o) => o && !o.__error).length };
  } finally { running = false; }
};

const startHealthMonitor = () => {
  if (process.env.HEALTH_MONITOR_ENABLED === 'false' || process.env.NODE_ENV === 'test' || timer) return;
  const minutes = Math.max(1, Number(process.env.HEALTH_CHECK_INTERVAL_MIN) || 15);
  const tick = () => runHealthChecks().catch((e) => console.error('Health monitor error:', e.message));
  timer = setInterval(tick, minutes * 60 * 1000);
  timer.unref();
  setTimeout(tick, 30 * 1000).unref(); // first run shortly after boot
  console.log(`🩺 Health monitor running every ${minutes} min`);
};

module.exports = { startHealthMonitor, runHealthChecks, checkTeamHealth, loadForCheck };
