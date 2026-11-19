/**
 * Git contribution scoring (pure functions, no I/O).
 *
 * Input commits are normalized objects:
 *   { sha, message, date, author_login, author_email, author_name, parents, files:[{filename,additions,deletions}] }
 * Members:
 *   [{ student_id, name, github_login, emails:[] }]
 *
 * The result is a SUGGESTION for the guide, never a final grade.
 */

const DEFAULT_WEIGHTS = {
  lines: 0.35,
  commits: 0.2,
  active_days: 0.15,
  pull_requests: 0.2,
  message_quality: 0.1,
};

// Lines per commit are capped so one giant dump cannot dominate the score.
const MAX_LINES_PER_COMMIT = 800;

const IGNORED_PATH_PATTERNS = [
  /(^|\/)package-lock\.json$/i,
  /(^|\/)yarn\.lock$/i,
  /(^|\/)pnpm-lock\.yaml$/i,
  /(^|\/)composer\.lock$/i,
  /(^|\/)node_modules\//i,
  /(^|\/)(dist|build|coverage|\.next|out)\//i,
  /\.min\.(js|css)$/i,
  /\.map$/i,
  /\.(png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|pdf|zip|mp4|mp3)$/i,
];

const GENERIC_MESSAGES = new Set([
  'update', 'updates', 'fix', 'fixes', 'changes', 'change', 'commit', 'wip', 'test',
  'asdf', 'final', 'done', 'code', 'files', 'add files', 'initial commit', '.', '..',
]);

const isIgnoredPath = (filename = '') => IGNORED_PATH_PATTERNS.some((re) => re.test(filename));

const isMergeCommit = (commit) => Array.isArray(commit?.parents) && commit.parents.length > 1;

/** 0..1 heuristic for commit message usefulness. */
const messageQuality = (message = '') => {
  const first = String(message).split('\n')[0].trim();
  if (!first) return 0;
  if (GENERIC_MESSAGES.has(first.toLowerCase())) return 0.1;
  const words = first.split(/\s+/).filter(Boolean).length;
  let score = 0.3;
  if (words >= 3) score += 0.3;
  if (words >= 5) score += 0.2;
  if (first.length >= 12 && first.length <= 72) score += 0.2;
  return Math.min(1, score);
};

/** Extract "login" from "12345+login@users.noreply.github.com" or "login@users.noreply.github.com". */
const loginFromNoreply = (email = '') => {
  const m = String(email).toLowerCase().match(/^(?:\d+\+)?([a-z0-9-]+)@users\.noreply\.github\.com$/);
  return m ? m[1] : null;
};

/** Extract "login" from a GitHub profile URL or plain handle. */
const parseGithubLogin = (value = '') => {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  const m = raw.match(/github\.com\/([A-Za-z0-9-]+)/i);
  if (m) return m[1].toLowerCase();
  return /^[A-Za-z0-9-]+$/.test(raw) ? raw.toLowerCase() : '';
};

const buildIdentityIndex = (members = []) => {
  const byLogin = new Map();
  const byEmail = new Map();
  members.forEach((m) => {
    const id = String(m.student_id);
    if (m.github_login) byLogin.set(String(m.github_login).toLowerCase(), id);
    (m.emails || []).forEach((e) => e && byEmail.set(String(e).toLowerCase(), id));
  });
  return { byLogin, byEmail };
};

const resolveAuthor = (commit, index) => {
  const login = (commit.author_login || '').toLowerCase();
  if (login && index.byLogin.has(login)) return index.byLogin.get(login);
  const email = (commit.author_email || '').toLowerCase();
  if (email && index.byEmail.has(email)) return index.byEmail.get(email);
  const noreply = loginFromNoreply(email);
  if (noreply && index.byLogin.has(noreply)) return index.byLogin.get(noreply);
  return null;
};

const effectiveLines = (commit) => {
  // Commits whose diff was not fetched (API budget) carry an estimate based on the author's other commits.
  if (commit.files == null && commit.imputed_lines != null) return Math.min(Math.round(commit.imputed_lines), MAX_LINES_PER_COMMIT);
  const raw = (commit.files || [])
    .filter((f) => !isIgnoredPath(f.filename))
    .reduce((sum, f) => sum + (f.additions || 0) + (f.deletions || 0), 0);
  return Math.min(raw, MAX_LINES_PER_COMMIT);
};

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

const normalizeWeights = (weights, availableKeys) => {
  const picked = {};
  let total = 0;
  availableKeys.forEach((k) => {
    picked[k] = Number(weights[k]) > 0 ? Number(weights[k]) : 0;
    total += picked[k];
  });
  if (total === 0) {
    availableKeys.forEach((k) => { picked[k] = 1 / availableKeys.length; });
    return picked;
  }
  availableKeys.forEach((k) => { picked[k] /= total; });
  return picked;
};

/**
 * @param {object} opts
 * @param {Array} opts.commits normalized commits
 * @param {Array} opts.members team members with github identity
 * @param {Object<string,number>} [opts.pullRequests] student_id -> PR count (optional)
 * @param {object} [opts.weights]
 * @param {Date} [opts.windowEnd] used for last-minute-surge flag
 */
const computeContribution = ({ commits = [], members = [], pullRequests = {}, weights = DEFAULT_WEIGHTS, windowEnd = null }) => {
  const index = buildIdentityIndex(members);
  const stats = new Map(members.map((m) => [String(m.student_id), {
    student_id: m.student_id,
    name: m.name,
    github_login: m.github_login || '',
    commits: 0,
    effective_lines: 0,
    days: new Set(),
    pull_requests: Number(pullRequests[String(m.student_id)] || 0),
    quality_sum: 0,
    max_commit_lines: 0,
    dates: [],
  }]));
  const unmapped = new Map();
  let analyzed = 0;

  commits.forEach((commit) => {
    if (isMergeCommit(commit)) return;
    analyzed += 1;
    const studentId = resolveAuthor(commit, index);
    if (!studentId) {
      const key = (commit.author_login || commit.author_email || commit.author_name || 'unknown').toLowerCase();
      const entry = unmapped.get(key) || { login: commit.author_login || '', email: commit.author_email || '', name: commit.author_name || '', commits: 0 };
      entry.commits += 1;
      unmapped.set(key, entry);
      return;
    }
    const s = stats.get(studentId);
    const lines = effectiveLines(commit);
    s.commits += 1;
    s.effective_lines += lines;
    s.max_commit_lines = Math.max(s.max_commit_lines, lines);
    s.quality_sum += messageQuality(commit.message);
    if (commit.date) { s.days.add(dayKey(commit.date)); s.dates.push(new Date(commit.date).getTime()); }
  });

  const rows = [...stats.values()].map((s) => ({
    student_id: s.student_id,
    name: s.name,
    github_login: s.github_login,
    commits: s.commits,
    effective_lines: s.effective_lines,
    active_days: s.days.size,
    pull_requests: s.pull_requests,
    message_quality: s.commits ? Number((s.quality_sum / s.commits).toFixed(2)) : 0,
    _max_commit_lines: s.max_commit_lines,
    _dates: s.dates,
  }));

  const totals = {
    lines: rows.reduce((a, r) => a + r.effective_lines, 0),
    commits: rows.reduce((a, r) => a + r.commits, 0),
    active_days: rows.reduce((a, r) => a + r.active_days, 0),
    pull_requests: rows.reduce((a, r) => a + r.pull_requests, 0),
    message_quality: rows.reduce((a, r) => a + r.message_quality * r.commits, 0),
  };
  const metricValue = {
    lines: (r) => r.effective_lines,
    commits: (r) => r.commits,
    active_days: (r) => r.active_days,
    pull_requests: (r) => r.pull_requests,
    message_quality: (r) => r.message_quality * r.commits, // quality-weighted activity
  };
  // Metrics nobody scored on are dropped and their weight redistributed.
  const usable = Object.keys(DEFAULT_WEIGHTS).filter((k) => totals[k] > 0);
  const w = usable.length ? normalizeWeights({ ...DEFAULT_WEIGHTS, ...weights }, usable) : {};

  const n = rows.length || 1;
  const equalShare = 100 / n;
  const end = windowEnd ? new Date(windowEnd).getTime() : Math.max(0, ...rows.flatMap((r) => r._dates));

  const result = rows.map((r) => {
    let share = 0;
    usable.forEach((k) => { share += w[k] * (metricValue[k](r) / totals[k]); });
    share = usable.length ? share * 100 : equalShare;

    const flags = [];
    if (r.commits === 0) flags.push('no_mapped_commits');
    if (r.effective_lines >= 300 && r._max_commit_lines / Math.max(1, r.effective_lines) >= 0.6) flags.push('bulk_dump');
    if (r.commits >= 5 && r._dates.length) {
      const recent = r._dates.filter((t) => end - t <= 3 * 86400000).length;
      if (recent / r._dates.length >= 0.7) flags.push('last_minute_surge');
    }
    const { _max_commit_lines, _dates, ...clean } = r;
    return {
      ...clean,
      share_percent: Number(share.toFixed(1)),
      equal_share_percent: Number(equalShare.toFixed(1)),
      // 100 if the student reached ~their fair share (10% tolerance), scaled linearly below that.
      suggested_score_100: Math.round(Math.min(1, share / (equalShare * 0.9)) * 100),
      flags,
    };
  });

  return {
    members: result,
    unmapped_authors: [...unmapped.values()].sort((a, b) => b.commits - a.commits),
    weights_used: w,
    analyzed_commits: analyzed,
  };
};

module.exports = {
  DEFAULT_WEIGHTS,
  MAX_LINES_PER_COMMIT,
  isIgnoredPath,
  isMergeCommit,
  messageQuality,
  loginFromNoreply,
  parseGithubLogin,
  buildIdentityIndex,
  resolveAuthor,
  effectiveLines,
  computeContribution,
};
