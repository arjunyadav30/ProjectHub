/**
 * Derives the repository-onboarding status for a team. Pure function.
 *
 * Status order: no_repo -> mapping_needed -> ready -> analyzed -> decided
 */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const hasRepo = (repo) => {
  if (!repo) return false;
  if (typeof repo === 'string') return Boolean(repo.trim());
  return Boolean(repo.full_name || repo.repo_full_name);
};

const deriveStatus = ({ repo, members = [], latestReport = null, now = Date.now() } = {}) => {
  const repoLinked = hasRepo(repo);
  const accepted = Array.isArray(members) ? members : [];
  const mappingComplete = repoLinked && accepted.every((m) => Boolean(String(m.github_login || '').trim()));
  const analyzed = Boolean(latestReport);
  const decided = Boolean(latestReport && latestReport.guide_decision && latestReport.guide_decision.decided_at);

  let status = 'no_repo';
  if (repoLinked) status = 'mapping_needed';
  if (mappingComplete) status = 'ready';
  if (mappingComplete && analyzed) status = 'analyzed';
  if (decided) status = 'decided';

  let stale = false;
  if (analyzed && latestReport.created_at) {
    const createdAt = new Date(latestReport.created_at).getTime();
    const nowMs = new Date(now).getTime();
    if (Number.isFinite(createdAt) && Number.isFinite(nowMs)) stale = nowMs - createdAt > SEVEN_DAYS_MS;
  }

  const steps = [
    { key: 'repo', done: repoLinked },
    { key: 'mapping', done: mappingComplete },
    { key: 'ready', done: mappingComplete },
    { key: 'analyzed', done: analyzed },
    { key: 'decided', done: decided },
  ];

  return { status, steps, stale };
};

module.exports = { deriveStatus, SEVEN_DAYS_MS };
