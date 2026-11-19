/**
 * Minimal GitHub REST client for contribution analysis.
 * Set GITHUB_TOKEN in .env to raise the rate limit from 60 to 5000 requests/hour.
 */
const { normalizeRepoUrl } = require('./repoUrl');
const { loginFromNoreply } = require('./contributionScore');

const API = 'https://api.github.com';

const parseRepo = (repoUrl = '') => {
  const normalized = normalizeRepoUrl(repoUrl);
  return normalized.ok ? normalized.full_name : null;
};

const headers = () => ({
  'User-Agent': 'ProjectHub-App',
  Accept: 'application/vnd.github+json',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

const ghGet = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  if (res.status === 404) throw new Error('Repository not found, or it is private');
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    const when = reset ? ` Resets at ${new Date(Number(reset) * 1000).toISOString()}.` : '';
    throw new Error(`GitHub rate limit reached.${when} Set GITHUB_TOKEN on the server to raise the limit.`);
  }
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return res.json();
};

const normalizeListCommit = (c) => ({
  sha: c.sha,
  message: c.commit?.message || '',
  date: c.commit?.author?.date || c.commit?.committer?.date || null,
  author_login: c.author?.login || '',
  author_email: c.commit?.author?.email || '',
  author_name: c.commit?.author?.name || '',
  parents: (c.parents || []).map((p) => p.sha),
});

const listCommits = async (fullName, { since, until, maxCommits = 300 } = {}) => {
  const out = [];
  const perPage = 100;
  for (let page = 1; out.length < maxCommits; page += 1) {
    const q = new URLSearchParams({ per_page: String(perPage), page: String(page) });
    if (since) q.set('since', new Date(since).toISOString());
    if (until) q.set('until', new Date(until).toISOString());
    const batch = await ghGet(`/repos/${fullName}/commits?${q}`);
    if (!Array.isArray(batch) || !batch.length) break;
    out.push(...batch.map(normalizeListCommit));
    if (batch.length < perPage) break;
  }
  return { commits: out.slice(0, maxCommits), truncated: out.length >= maxCommits };
};

const getCommitDetail = async (fullName, sha) => {
  const c = await ghGet(`/repos/${fullName}/commits/${sha}`);
  return {
    ...normalizeListCommit(c),
    files: (c.files || []).map((f) => ({ filename: f.filename, additions: f.additions || 0, deletions: f.deletions || 0, patch: f.patch || '' })),
  };
};

/** Pull requests authored per GitHub login (up to 300 most recent). */
const countPullRequests = async (fullName, maxPages = 3) => {
  const counts = {};
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await ghGet(`/repos/${fullName}/pulls?state=all&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || !batch.length) break;
    batch.forEach((pr) => { const l = (pr.user?.login || '').toLowerCase(); if (l) counts[l] = (counts[l] || 0) + 1; });
    if (batch.length < 100) break;
  }
  return counts;
};

/** Public repository metadata used by the onboarding preview. */
const getRepoInfo = async (fullName) => {
  const r = await ghGet(`/repos/${fullName}`);
  return {
    full_name: r.full_name,
    description: r.description || '',
    default_branch: r.default_branch || 'main',
    archived: Boolean(r.archived),
    fork: Boolean(r.fork),
    created_at: r.created_at || null,
    pushed_at: r.pushed_at || null,
    stars: r.stargazers_count || 0,
    language: r.language || '',
    size: r.size || 0,
    empty: (r.size || 0) === 0,
  };
};

/** Aggregates recent commits into contributor candidates (login, fallback email). */
const listContributorCandidates = async (fullName, { since, until, maxCommits = 300 } = {}) => {
  const { commits } = await listCommits(fullName, { since, until, maxCommits });
  const byAuthor = new Map();
  commits.forEach((c) => {
    const login = String(c.author_login || '').toLowerCase();
    const email = String(c.author_email || '').toLowerCase();
    const name = c.author_name || '';
    const key = login || email || name.toLowerCase();
    if (!key) return;
    const current = byAuthor.get(key) || {
      login: login || loginFromNoreply(email) || '',
      email,
      name,
      commits: 0,
    };
    current.commits += 1;
    if (!current.name && name) current.name = name;
    if (!current.email && email) current.email = email;
    byAuthor.set(key, current);
  });
  return [...byAuthor.values()].sort((a, b) => b.commits - a.commits);
};

const mapWithConcurrency = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next; next += 1;
      try { results[i] = await fn(items[i], i); } catch (e) { results[i] = { __error: e.message }; }
    }
  });
  await Promise.all(workers);
  return results;
};

module.exports = {
  parseRepo,
  getRepoInfo,
  listCommits,
  listContributorCandidates,
  getCommitDetail,
  countPullRequests,
  mapWithConcurrency,
};
