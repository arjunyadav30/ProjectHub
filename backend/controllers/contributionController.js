const crypto = require('crypto');
const Team = require('../models/Team');
const Event = require('../models/Event');
const Faculty = require('../models/Faculty');
const Notification = require('../models/Notification');
const ContributionReport = require('../models/ContributionReport');
const apiResponse = require('../utils/apiResponse');
const { getTeamAccess, canManageEvent } = require('../utils/teamAccess');
const {
  parseRepo, listCommits, getCommitDetail, countPullRequests, mapWithConcurrency,
  getRepoInfo, listContributorCandidates,
} = require('../utils/githubClient');
const {
  DEFAULT_WEIGHTS, computeContribution, parseGithubLogin, buildIdentityIndex, resolveAuthor, isMergeCommit, effectiveLines,
} = require('../utils/contributionScore');
const { normalizeRepoUrl } = require('../utils/repoUrl');
const { suggestMappings } = require('../utils/identityMatcher');
const { deriveStatus } = require('../utils/onboardingStatus');
const { createRateLimiter } = require('../utils/rateWindow');
const { createNotifications } = require('../utils/notifications');

const httpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const parseWindowDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** Loads a team (with member profiles) and returns access info or an [status, message] error. */
const loadTeamWithAccess = async (teamId, user, { requireManager = false } = {}) => {
  const team = await Team.findById(teamId).populate('members.student_id', 'name email github_link');
  if (!team) return { error: [404, 'Team not found'] };
  const access = await getTeamAccess(user, team);
  if (!access.sameCollege) return { error: [404, 'Team not found'] };
  if (requireManager) {
    if (!access.isAdmin && !access.isMentor) return { error: [403, 'Only the accepted mentor or an admin can do this'] };
  } else if (!access.isAdmin && !access.isMentor && !access.isMember) {
    return { error: [403, 'Not allowed'] };
  }
  return { team, access };
};

/** Event scope: managers see every approved team; other faculty see only teams they mentor. */
const loadEventScope = async (eventId, user, { managerOnly = false } = {}) => {
  const event = await Event.findById(eventId).select('college_id title registration_start event_end_date created_by');
  if (!event || event.college_id?.toString() !== user.college_id?.toString()) return { error: [404, 'Event not found'] };
  const manager = canManageEvent(user, event);
  if (managerOnly && !manager) return { error: [403, 'Only the event owner or an admin can do this'] };
  if (manager) return { event, manager: true };
  if (user.role !== 'faculty') return { error: [403, 'Not allowed'] };
  const faculty = await Faculty.findOne({ user_id: user._id }).select('_id');
  if (!faculty) return { error: [403, 'Not allowed'] };
  return { event, manager: false, faculty };
};

const loadScopeTeams = async (scope, user) => {
  const filter = {
    event_id: scope.event._id,
    college_id: user.college_id,
    registration_status: 'approved',
  };
  if (!scope.manager) {
    filter.assigned_faculty = scope.faculty._id;
    filter.mentor_status = 'accepted';
  }
  return Team.find(filter)
    .select('team_name members assigned_faculty project.github project.github_link project.title')
    .populate('members.student_id', 'name email github_link')
    .populate('assigned_faculty', 'name')
    .lean();
};

const latestReportsByTeam = async (collegeId, teamIds) => {
  if (!teamIds.length) return new Map();
  const rows = await ContributionReport.aggregate([
    { $match: { college_id: collegeId, team_id: { $in: teamIds } } },
    { $sort: { created_at: -1 } },
    {
      $group: {
        _id: '$team_id',
        created_at: { $first: '$created_at' },
        decided_at: { $first: '$guide_decision.decided_at' },
        repo_full_name: { $first: '$repo_full_name' },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
};

/** Accepted-member identities with the source of the GitHub login. */
const memberIdentityRows = (team) => {
  const mapping = new Map((team.project?.github?.author_map || []).map((entry) => [String(entry.student_id), entry]));
  return (team.members || [])
    .filter((m) => m.status === 'accepted' && m.student_id)
    .map((m) => {
      const student = m.student_id;
      const override = mapping.get(String(student._id));
      const fromProfile = parseGithubLogin(student.github_link);
      const login = String(override?.github_login || fromProfile || '').toLowerCase();
      return {
        student_id: student._id,
        name: student.name,
        github_login: login,
        source: override?.github_login ? 'mapping' : fromProfile ? 'profile' : null,
      };
    });
};

const latestReportShape = (row) => (row ? {
  created_at: row.created_at,
  guide_decision: { decided_at: row.decided_at || null },
} : null);

const repoSummary = (team) => {
  const github = team.project?.github || {};
  const fullName = github.repo_full_name || parseRepo(team.project?.github_link) || '';
  if (!fullName) return null;
  return {
    full_name: fullName,
    url: github.repo_url || team.project?.github_link || `https://github.com/${fullName}`,
    linked_at: github.repo_linked_at || null,
  };
};

const onboardingPayload = (team, latestReport) => {
  const members = memberIdentityRows(team);
  const repo = repoSummary(team);
  const { status, steps, stale } = deriveStatus({
    repo: repo ? { full_name: repo.full_name } : null,
    members,
    latestReport,
    now: new Date(),
  });
  return {
    status,
    steps,
    stale,
    repo,
    members,
    last_report_at: latestReport?.created_at || null,
    decided: Boolean(latestReport?.guide_decision?.decided_at),
  };
};

const COOLDOWN_MS = 60 * 1000;
const REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_DETAIL = () => Number(process.env.GITHUB_MAX_DETAIL_COMMITS) || (process.env.GITHUB_TOKEN ? 150 : 40);
const previewLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

// In-memory analysis jobs. They are intentionally not persisted: a backend restart loses them.
const analysisJobs = new Map();

/** Accepted members with their GitHub identity (author_map overrides the profile link). */
const buildMembers = (team) => {
  const map = new Map((team.project?.github?.author_map || []).map((a) => [String(a.student_id), a]));
  return (team.members || [])
    .filter((m) => m.status === 'accepted' && m.student_id)
    .map((m) => {
      const s = m.student_id;
      const override = map.get(String(s._id));
      return {
        student_id: s._id,
        name: s.name,
        github_login: (override?.github_login || parseGithubLogin(s.github_link) || '').toLowerCase(),
        emails: [...new Set([s.email, ...(override?.emails || [])].filter(Boolean))],
      };
    });
};

/**
 * Pick which commits get a full diff fetch, round-robin across authors so every student is sampled fairly.
 */
const pickDetailTargets = (commits, index, budget) => {
  const byAuthor = new Map();
  commits.filter((c) => !isMergeCommit(c)).forEach((c) => {
    const k = resolveAuthor(c, index) || 'unmapped';
    if (k === 'unmapped') return;
    if (!byAuthor.has(k)) byAuthor.set(k, []);
    byAuthor.get(k).push(c);
  });
  const queues = [...byAuthor.values()];
  const picked = [];
  for (let round = 0; picked.length < budget; round += 1) {
    let added = false;
    queues.forEach((q) => { if (q[round] && picked.length < budget) { picked.push(q[round]); added = true; } });
    if (!added) break;
  }
  return picked;
};

/**
 * Reusable analysis core shared by the single-team endpoint and the event-wide job.
 * `team` must have members.student_id populated with name/email/github_link.
 */
const runAnalysisForTeam = async (team, user, { since = null, until = null, eventOnly = false } = {}) => {
  const fullName = team.project?.github?.repo_full_name || parseRepo(team.project?.github_link);
  if (!fullName) throw httpError('No GitHub repository linked to this team project', 400);

  let sinceDate = since ? new Date(since) : null;
  let untilDate = until ? new Date(until) : null;
  if ((sinceDate && Number.isNaN(sinceDate.getTime())) || (untilDate && Number.isNaN(untilDate.getTime()))) {
    throw httpError('Invalid since/until date', 400);
  }
  if (eventOnly) {
    const event = await Event.findById(team.event_id).select('registration_start event_end_date');
    if (event) {
      if (!sinceDate && event.registration_start) sinceDate = new Date(event.registration_start);
      if (!untilDate && event.event_end_date) untilDate = new Date(event.event_end_date);
    }
  }

  const members = buildMembers(team);
  if (!members.length) throw httpError('Team has no accepted members', 400);
  const index = buildIdentityIndex(members);
  const notes = [];

  const { commits, truncated } = await listCommits(fullName, { since: sinceDate, until: untilDate });
  if (!commits.length) throw httpError('No commits found in the selected window', 400);

  // Fetch diffs for a fair sample; estimate the rest from each author's own average.
  const targets = pickDetailTargets(commits, index, MAX_DETAIL());
  const details = await mapWithConcurrency(targets, 5, (c) => getCommitDetail(fullName, c.sha));
  const detailBySha = new Map();
  details.forEach((d) => { if (d && !d.__error) detailBySha.set(d.sha, d); });
  const failed = details.filter((d) => d?.__error).length;
  if (failed) notes.push(`${failed} commit diff(s) could not be fetched and were estimated.`);

  const sums = new Map();
  detailBySha.forEach((d) => {
    const k = resolveAuthor(d, index);
    if (!k) return;
    const cur = sums.get(k) || { total: 0, n: 0 };
    cur.total += effectiveLines(d); cur.n += 1; sums.set(k, cur);
  });
  let estimated = 0;
  const enriched = commits.map((c) => {
    const d = detailBySha.get(c.sha);
    if (d) return { ...c, files: d.files };
    const k = resolveAuthor(c, index);
    const s = k && sums.get(k);
    if (s && !isMergeCommit(c)) { estimated += 1; return { ...c, files: null, imputed_lines: s.total / s.n }; }
    return { ...c, files: [] };
  });
  if (estimated) notes.push(`Line counts for ${estimated} commit(s) were estimated from each author's analyzed commits (API budget ${MAX_DETAIL()}).`);
  if (truncated) notes.push('Only the most recent 300 commits were analyzed.');

  let pullRequests = {};
  try {
    const prByLogin = await countPullRequests(fullName);
    members.forEach((m) => { pullRequests[String(m.student_id)] = prByLogin[m.github_login] || 0; });
  } catch (e) { notes.push(`Pull request data unavailable: ${e.message}`); pullRequests = {}; }

  const result = computeContribution({ commits: enriched, members, pullRequests, weights: DEFAULT_WEIGHTS, windowEnd: untilDate });
  if (result.unmapped_authors.length) notes.push('Some commit authors could not be matched to team members. Set the GitHub identity mapping and regenerate.');

  return ContributionReport.create({
    college_id: team.college_id,
    team_id: team._id,
    event_id: team.event_id,
    generated_by: user._id,
    repo_full_name: fullName,
    window: { since: sinceDate, until: untilDate },
    weights_used: result.weights_used,
    fetched_commits: commits.length,
    analyzed_commits: result.analyzed_commits,
    detail_commits_fetched: detailBySha.size,
    truncated,
    notes,
    members: result.members,
    unmapped_authors: result.unmapped_authors.slice(0, 20),
  });
};

exports.generateReport = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId).populate('members.student_id', 'name email github_link');
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    const access = await getTeamAccess(req.user, team);
    if (!access.isAdmin && !access.isMentor) return apiResponse.error(res, 'Only the accepted mentor or an admin can generate contribution reports', 403);

    const last = await ContributionReport.findOne({ team_id: team._id }).sort({ created_at: -1 }).select('created_at');
    if (last && Date.now() - last.created_at.getTime() < COOLDOWN_MS) {
      return apiResponse.error(res, 'A report was generated less than a minute ago. Please wait before regenerating.', 429);
    }

    const report = await runAnalysisForTeam(team, req.user, {
      since: req.body.since,
      until: req.body.until,
      eventOnly: Boolean(req.body.event_only),
    });
    return apiResponse.created(res, report, 'Contribution report generated');
  } catch (error) {
    if (error.status) return apiResponse.error(res, error.message, error.status);
    if (/GitHub|Repository/.test(error.message)) return apiResponse.error(res, error.message, 502);
    return next(error);
  }
};

exports.getLatestReport = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId).select('college_id assigned_faculty mentor_status members team_name project.github');
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    const access = await getTeamAccess(req.user, team);
    if (!access.isAdmin && !access.isMentor) return apiResponse.error(res, 'Not allowed', 403);
    const report = await ContributionReport.findOne({ team_id: team._id }).sort({ created_at: -1 }).populate('members.student_id', 'name enrollment_no');
    return apiResponse.success(res, { team_name: team.team_name, author_map: team.project?.github?.author_map || [], report });
  } catch (error) { return next(error); }
};

exports.setAuthorMap = async (req, res, next) => {
  try {
    const { mappings } = req.body;
    if (!Array.isArray(mappings)) return apiResponse.error(res, 'mappings must be an array', 400);
    const team = await Team.findById(req.params.teamId);
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    const access = await getTeamAccess(req.user, team);
    if (!access.isAdmin && !access.isMentor && !access.isMember) return apiResponse.error(res, 'Not allowed', 403);

    const memberIds = new Set(team.members.filter((m) => m.status === 'accepted').map((m) => String(m.student_id)));
    const clean = [];
    for (const m of mappings) {
      if (!memberIds.has(String(m.student_id))) return apiResponse.error(res, 'student_id is not an accepted team member', 400);
      const login = parseGithubLogin(m.github_login);
      if (m.github_login && !login) return apiResponse.error(res, 'Invalid GitHub username', 400);
      const emails = (Array.isArray(m.emails) ? m.emails : []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^\S+@\S+\.\S+$/.test(e)).slice(0, 5);
      clean.push({ student_id: m.student_id, github_login: login, emails });
    }
    team.project.github.author_map = clean;
    await team.save();
    return apiResponse.success(res, team.project.github.author_map, 'GitHub identity mapping saved');
  } catch (error) { return next(error); }
};

exports.saveDecision = async (req, res, next) => {
  try {
    const { scores, comment = '' } = req.body;
    const report = await ContributionReport.findById(req.params.reportId);
    if (!report) return apiResponse.error(res, 'Report not found', 404);
    const team = await Team.findById(report.team_id).select('college_id assigned_faculty mentor_status');
    const access = await getTeamAccess(req.user, team);
    if (!access.isAdmin && !access.isMentor) return apiResponse.error(res, 'Only the accepted mentor or an admin can finalize contribution scores', 403);
    if (!Array.isArray(scores) || !scores.length) return apiResponse.error(res, 'scores are required', 400);

    const valid = new Set(report.members.map((m) => String(m.student_id)));
    const clean = [];
    for (const s of scores) {
      const v = Number(s.score_100);
      if (!valid.has(String(s.student_id)) || !Number.isFinite(v) || v < 0 || v > 100) return apiResponse.error(res, 'Each score needs a team member id and a value between 0 and 100', 400);
      clean.push({ student_id: s.student_id, score_100: Math.round(v) });
    }
    report.guide_decision = { scores: clean, comment: String(comment).slice(0, 1000), decided_by: req.user._id, decided_at: new Date() };
    await report.save();
    return apiResponse.success(res, report.guide_decision, 'Contribution scores finalized');
  } catch (error) { return next(error); }
};

exports.eventSummary = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select('college_id title');
    if (!event || event.college_id.toString() !== req.user.college_id?.toString()) return apiResponse.error(res, 'Event not found', 404);
    const filter = { event_id: event._id, college_id: req.user.college_id };
    const latest = await ContributionReport.aggregate([
      { $match: filter }, { $sort: { created_at: -1 } },
      { $group: { _id: '$team_id', report_id: { $first: '$_id' }, generated_at: { $first: '$created_at' }, members: { $first: '$members' }, decided: { $first: '$guide_decision.decided_at' } } },
    ]);
    return apiResponse.success(res, latest);
  } catch (error) { return next(error); }
};

const buildEventOnboarding = async (scope, user) => {
  const teams = await loadScopeTeams(scope, user);
  const reportMap = await latestReportsByTeam(user.college_id, teams.map((t) => t._id));
  const rows = teams.map((team) => {
    const members = memberIdentityRows(team);
    const latestReport = latestReportShape(reportMap.get(String(team._id)));
    const repo = repoSummary(team);
    const derived = deriveStatus({
      repo: repo ? { full_name: repo.full_name } : null,
      members,
      latestReport,
      now: new Date(),
    });
    return { team, members, latestReport, repo, ...derived };
  });
  return { teams, rows };
};

exports.previewRepo = async (req, res, next) => {
  try {
    const limit = previewLimiter.check(String(req.user._id));
    if (!limit.allowed) {
      const minutes = Math.max(1, Math.ceil(limit.retryAfterMs / 60000));
      return apiResponse.error(res, `Too many repository previews. Please try again in ${minutes} minute(s).`, 429);
    }

    const since = parseWindowDate(req.body?.since);
    const until = parseWindowDate(req.body?.until);
    if (since === undefined || until === undefined) return apiResponse.error(res, 'Invalid since/until date', 400);

    const normalized = normalizeRepoUrl(req.body?.repo_url);
    if (!normalized.ok) return apiResponse.error(res, normalized.error, 400);

    let team = null;
    let members = null;
    let event = null;
    if (req.body?.team_id) {
      const loaded = await loadTeamWithAccess(req.body.team_id, req.user);
      if (loaded.error) return apiResponse.error(res, loaded.error[1], loaded.error[0]);
      team = loaded.team;
      members = buildMembers(team);
      event = team.event_id ? await Event.findById(team.event_id).select('registration_start event_end_date title') : null;
    }

    let info;
    try {
      info = await getRepoInfo(normalized.full_name);
    } catch (error) {
      return apiResponse.error(res, error.message, /rate limit/i.test(error.message) ? 429 : 502);
    }

    let candidates = [];
    try {
      candidates = await listContributorCandidates(normalized.full_name, { since, until });
    } catch (error) {
      if (!info.empty && !/409/.test(error.message)) {
        return apiResponse.error(res, error.message, /rate limit/i.test(error.message) ? 429 : 502);
      }
    }

    // Candidate emails are only returned to callers authorized for a team (and are never stored here).
    const responseCandidates = team
      ? candidates
      : candidates.map(({ email, ...rest }) => ({ ...rest, email: '' }));

    let suggestions = null;
    if (team) {
      suggestions = suggestMappings({
        members: members.map((m) => ({
          student_id: m.student_id,
          name: m.name,
          email: m.emails[0] || '',
          emails: m.emails,
          github_login: m.github_login,
        })),
        candidates: responseCandidates,
      });
    }

    const registrationStart = event?.registration_start ? new Date(event.registration_start) : null;
    const repoCreated = info.created_at ? new Date(info.created_at) : null;
    const predatesEvent = Boolean(registrationStart && repoCreated && repoCreated < registrationStart);

    const checks = [
      { key: 'public', ok: true, detail: 'Public repository is reachable.' },
      { key: 'not_empty', ok: !info.empty, detail: info.empty ? 'Repository is empty.' : 'Repository has content.' },
      {
        key: 'has_commits',
        ok: candidates.length > 0,
        detail: candidates.length
          ? `${candidates.length} contributor account(s) have commits in the selected window.`
          : 'No commits were found in the selected window.',
      },
      {
        key: 'repo_predates_event',
        ok: registrationStart ? !predatesEvent : true,
        detail: !registrationStart
          ? 'No event registration window is available to compare against.'
          : predatesEvent
            ? `Repository was created before registration opened (${registrationStart.toISOString().slice(0, 10)}). Earlier work is allowed, but your guide will see it.`
            : 'Repository was created during or after the event registration window.',
      },
      { key: 'fork', ok: !info.fork, detail: info.fork ? 'This repository is a fork.' : 'This repository is not a fork.' },
    ];
    const warnings = checks.filter((check) => !check.ok).map((check) => check.detail);
    if (info.archived) warnings.push('This repository is archived and will not receive new commits.');

    return apiResponse.success(res, {
      repo: info,
      candidates: responseCandidates,
      ...(team ? { suggestions } : {}),
      checks,
      warnings,
    });
  } catch (error) { return next(error); }
};

exports.setTeamRepo = async (req, res, next) => {
  try {
    const normalized = normalizeRepoUrl(req.body?.repo_url);
    if (!normalized.ok) return apiResponse.error(res, normalized.error, 400);

    const loaded = await loadTeamWithAccess(req.params.teamId, req.user);
    if (loaded.error) return apiResponse.error(res, loaded.error[1], loaded.error[0]);
    const { team } = loaded;

    const previousFullName = team.project?.github?.repo_full_name || parseRepo(team.project?.github_link) || '';
    const hasReport = await ContributionReport.exists({ team_id: team._id });
    const changed = Boolean(previousFullName && previousFullName.toLowerCase() !== normalized.full_name.toLowerCase());

    team.project.github_link = normalized.canonical_url;
    team.project.github.repo_url = normalized.canonical_url;
    team.project.github.repo_full_name = normalized.full_name;
    team.project.github.repo_linked_at = new Date();
    team.project.github.repo_linked_by = req.user._id;
    await team.save();

    const warning = changed && hasReport
      ? 'This repository was changed after an analysis. Earlier reports belong to the previous repository; regenerate the analysis.'
      : null;
    return apiResponse.success(res, {
      repo: {
        full_name: normalized.full_name,
        url: normalized.canonical_url,
        linked_at: team.project.github.repo_linked_at,
      },
      changed,
      warning,
    }, warning ? 'Repository updated. Earlier reports belong to the previous repository.' : 'Repository linked');
  } catch (error) { return next(error); }
};

exports.getOnboarding = async (req, res, next) => {
  try {
    const loaded = await loadTeamWithAccess(req.params.teamId, req.user);
    if (loaded.error) return apiResponse.error(res, loaded.error[1], loaded.error[0]);
    const latest = await ContributionReport.findOne({ team_id: loaded.team._id })
      .sort({ created_at: -1 })
      .select('created_at guide_decision.decided_at repo_full_name')
      .lean();
    return apiResponse.success(res, onboardingPayload(loaded.team, latestReportShape(latest)));
  } catch (error) { return next(error); }
};

exports.getEventOnboarding = async (req, res, next) => {
  try {
    const scope = await loadEventScope(req.params.eventId, req.user);
    if (scope.error) return apiResponse.error(res, scope.error[1], scope.error[0]);

    const { rows } = await buildEventOnboarding(scope, req.user);
    const funnel = { no_repo: 0, mapping_needed: 0, ready: 0, analyzed: 0, decided: 0, total: rows.length };
    const out = rows.map(({ team, members, latestReport, repo, status, stale }) => {
      funnel[status] += 1;
      return {
        team_id: team._id,
        team_name: team.team_name,
        mentor_name: team.assigned_faculty?.name || '',
        repo_full_name: repo?.full_name || '',
        mapped_count: members.filter((m) => m.github_login).length,
        members_count: members.length,
        status,
        stale,
        last_report_at: latestReport?.created_at || null,
      };
    });
    return apiResponse.success(res, { funnel, rows: out });
  } catch (error) { return next(error); }
};

exports.remindOnboarding = async (req, res, next) => {
  try {
    const scope = await loadEventScope(req.params.eventId, req.user, { managerOnly: true });
    if (scope.error) return apiResponse.error(res, scope.error[1], scope.error[0]);

    const allowed = new Set(['no_repo', 'mapping_needed']);
    const requested = Array.isArray(req.body?.statuses) ? req.body.statuses : [...allowed];
    const statuses = [...new Set(requested.filter((s) => allowed.has(s)))];
    if (!statuses.length) return apiResponse.error(res, 'Choose no_repo and/or mapping_needed', 400);

    const { rows } = await buildEventOnboarding(scope, req.user);
    const targets = rows.filter((row) => statuses.includes(row.status)).slice(0, 200);
    const teamIds = targets.map((row) => row.team._id);
    const existing = teamIds.length
      ? await Notification.find({
        college_id: req.user.college_id,
        type: 'repo_reminder',
        reference_id: { $in: teamIds },
        created_at: { $gte: new Date(Date.now() - REMIND_COOLDOWN_MS) },
      }).select('reference_id').lean()
      : [];
    const cooledDown = new Set(existing.map((n) => String(n.reference_id)));

    const notified = [];
    const skipped = [];
    for (const row of targets) {
      const { team } = row;
      if (cooledDown.has(String(team._id))) {
        skipped.push({ team_id: team._id, team_name: team.team_name, reason: 'Already reminded in the last 24 hours.' });
        continue;
      }
      const recipients = (team.members || [])
        .filter((m) => m.status === 'accepted')
        .map((m) => m.user_id || m.student_id?.user_id)
        .filter(Boolean);
      if (!recipients.length) {
        skipped.push({ team_id: team._id, team_name: team.team_name, reason: 'No accepted members with accounts.' });
        continue;
      }
      await createNotifications(recipients.map((recipient) => ({
        recipient,
        type: 'repo_reminder',
        title: 'Link your GitHub repository',
        message: `${team.team_name}: link your GitHub repository so contribution analysis can start. Open the team's Repository & contributors card to continue.`,
        reference_id: team._id,
        reference_type: 'Team',
      })));
      notified.push(team._id);
    }

    return apiResponse.success(res, {
      notified_teams: notified,
      skipped,
      notified_count: notified.length,
      skipped_count: skipped.length,
      statuses,
    }, `Reminded ${notified.length} team(s).`);
  } catch (error) { return next(error); }
};

exports.startAnalyzeAll = async (req, res, next) => {
  try {
    const scope = await loadEventScope(req.params.eventId, req.user, { managerOnly: true });
    if (scope.error) return apiResponse.error(res, scope.error[1], scope.error[0]);

    const since = parseWindowDate(req.body?.since);
    const until = parseWindowDate(req.body?.until);
    if (since === undefined || until === undefined) return apiResponse.error(res, 'Invalid since/until date', 400);

    const running = [...analysisJobs.values()].find((job) => (
      job.status === 'running' && String(job.event_id) === String(scope.event._id)
    ));
    if (running) return apiResponse.error(res, 'An analysis job is already running for this event.', 409);

    const onlyStale = Boolean(req.body?.only_stale);
    const { rows } = await buildEventOnboarding(scope, req.user);
    const eligible = rows
      .filter((row) => (onlyStale ? row.status === 'analyzed' && row.stale : row.status === 'ready'))
      .slice(0, 100);

    const job = {
      id: crypto.randomUUID(),
      event_id: String(scope.event._id),
      college_id: String(req.user.college_id),
      status: 'running',
      total: eligible.length,
      done: 0,
      failed: [],
      message: '',
      started_at: new Date(),
    };
    analysisJobs.set(job.id, job);

    (async () => {
      for (const row of eligible) {
        try {
          const team = await Team.findById(row.team._id).populate('members.student_id', 'name email github_link');
          if (!team) throw new Error('Team not found');
          await runAnalysisForTeam(team, req.user, { since, until });
          job.done += 1;
        } catch (error) {
          if (/rate limit/i.test(error.message)) {
            job.status = 'paused_rate_limit';
            job.message = 'GitHub rate limit reached. Set GITHUB_TOKEN in the backend environment to raise the limit, then start the job again.';
            return;
          }
          job.done += 1;
          job.failed.push({ team_id: row.team._id, team_name: row.team.team_name, error: error.message });
        }
        // Gentle pacing keeps large events from exhausting the GitHub API budget.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      job.status = 'done';
    })().catch((error) => {
      job.status = 'failed';
      job.message = error.message;
    });

    return apiResponse.success(res, { job_id: job.id, total: job.total }, 'Analysis job started');
  } catch (error) { return next(error); }
};

exports.getAnalyzeAllStatus = async (req, res, next) => {
  try {
    const job = analysisJobs.get(req.params.jobId);
    if (!job
      || String(job.college_id) !== String(req.user.college_id)
      || String(job.event_id) !== String(req.params.eventId)) {
      return apiResponse.error(res, 'Job not found', 404);
    }
    return apiResponse.success(res, {
      status: job.status,
      total: job.total,
      done: job.done,
      failed: job.failed,
      message: job.message,
    });
  } catch (error) { return next(error); }
};

exports.buildMembers = buildMembers;
