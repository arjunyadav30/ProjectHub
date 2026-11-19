/**
 * Normalizes any common GitHub repository reference into a canonical owner/repo pair.
 * Pure function: no network calls, no storage.
 */

const RESERVED_OWNERS = new Set([
  'settings', 'orgs', 'organizations', 'marketplace', 'explore', 'topics', 'trending',
  'collections', 'sponsors', 'notifications', 'pulls', 'issues', 'login', 'join',
  'signup', 'about', 'features', 'enterprise', 'pricing', 'search', 'new', 'apps',
  'contact', 'site', 'security', 'team', 'customers', 'events', 'readme', 'stars',
  'watching', 'dashboard', 'account', 'billing', 'codespaces', 'discussions', 'packages',
]);

const OWNER_RE = /^[A-Za-z0-9-]{1,39}$/;
const REPO_RE = /^[A-Za-z0-9_.-]{1,100}$/;

const fail = (error) => ({
  ok: false, owner: null, repo: null, full_name: null, canonical_url: null, branch: null, error,
});

const build = (owner, repo, branch) => {
  const o = String(owner || '').trim();
  const r = String(repo || '').trim().replace(/\.git$/i, '');
  if (RESERVED_OWNERS.has(o.toLowerCase())) return fail('This GitHub path is not a repository link.');
  if (!OWNER_RE.test(o)) return fail('Invalid GitHub owner name.');
  if (!REPO_RE.test(r) || r === '.' || r === '..') return fail('Invalid repository name.');
  return {
    ok: true,
    owner: o,
    repo: r,
    full_name: `${o}/${r}`,
    canonical_url: `https://github.com/${o}/${r}`,
    branch: branch || null,
    error: null,
  };
};

const branchFromPath = (rest) => {
  if (!rest.length) return null;
  const route = String(rest[0] || '').toLowerCase();
  if (route === 'tree') return rest.slice(1).join('/') || null;
  // A blob URL is /blob/<branch>/<file...>; only the first segment can be used reliably.
  if (route === 'blob') return rest[1] || null;
  return null;
};

const normalizeRepoUrl = (input) => {
  if (typeof input !== 'string') return fail('Repository URL is required.');
  const source = input.trim();
  if (!source) return fail('Repository URL is required.');

  // git@github.com:owner/repo.git
  const ssh = source.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?(?:[?#].*)?$/i);
  if (ssh) return build(ssh[1], ssh[2], null);

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(source);
  const looksLikeGithubHost = /^(www\.)?github\.com\//i.test(source);

  if (hasScheme || looksLikeGithubHost) {
    let url;
    try {
      url = new URL(hasScheme ? source : `https://${source}`);
    } catch (_) {
      return fail('Enter a valid repository URL.');
    }
    if (!/^https?:$/i.test(url.protocol)) return fail('Only GitHub repositories are supported.');
    const host = url.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') return fail('Only GitHub repositories are supported.');
    let parts;
    try {
      parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    } catch (_) {
      return fail('Enter a valid repository URL.');
    }
    if (parts.length < 2) return fail('Enter a repository like https://github.com/owner/repo.');
    return build(parts[0], parts[1], branchFromPath(parts.slice(2)));
  }

  // Shorthand: owner/repo or owner/repo/tree/branch
  const parts = source.split(/[?#]/)[0].split('/').filter(Boolean);
  if (parts.length < 2) return fail('Enter a repository like https://github.com/owner/repo.');
  // Anything that looks like a hostname (gitlab.com, bitbucket.org) is not accepted.
  if (parts[0].includes('.')) return fail('Only GitHub repositories are supported.');
  return build(parts[0], parts[1], branchFromPath(parts.slice(2)));
};

module.exports = { normalizeRepoUrl, RESERVED_OWNERS };
