const Team = require('../models/Team');
const apiResponse = require('../utils/apiResponse');
const { getTeamAccess } = require('../utils/teamAccess');
const { normalizeRepoUrl } = require('../utils/repoUrl');

const parseRepo = (repoUrl = '') => {
  const normalized = normalizeRepoUrl(repoUrl);
  return normalized.ok ? normalized.full_name : null;
};

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': 'ProjectHub-App' } });
  if (response.status === 404) throw new Error('Repository not found, or it is private');
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json();
};

/** Loads a team and requires same-college membership, mentorship or admin access. */
const authorizeTeamAccess = async (user, teamId) => {
  const team = await Team.findById(teamId);
  if (!team) return { error: [404, 'Team not found'] };
  const access = await getTeamAccess(user, team);
  if (!access.sameCollege) return { error: [404, 'Team not found'] };
  if (!access.isAdmin && !access.isMentor && !access.isMember) return { error: [403, 'Not allowed'] };
  return { team };
};

exports.connectGithubRepo = async (req, res, next) => {
  try {
    const { repo_url } = req.body;
    if (!repo_url) return apiResponse.error(res, 'repo_url is required', 400);

    const authorized = await authorizeTeamAccess(req.user, req.params.teamId);
    if (authorized.error) return apiResponse.error(res, authorized.error[1], authorized.error[0]);
    const { team } = authorized;

    const normalized = normalizeRepoUrl(repo_url);
    if (!normalized.ok) return apiResponse.error(res, normalized.error, 400);

    team.project.github.repo_url = normalized.canonical_url;
    team.project.github_link = normalized.canonical_url;
    team.project.github.repo_full_name = normalized.full_name;
    team.project.github.repo_linked_at = new Date();
    team.project.github.repo_linked_by = req.user._id;
    await team.save();

    return apiResponse.success(res, team.project.github, 'Repository connected');
  } catch (error) { return next(error); }
};

exports.syncGithubRepo = async (req, res, next) => {
  try {
    const authorized = await authorizeTeamAccess(req.user, req.params.teamId);
    if (authorized.error) return apiResponse.error(res, authorized.error[1], authorized.error[0]);
    const { team } = authorized;

    const fullName = team.project.github.repo_full_name;
    if (!fullName) return apiResponse.error(res, 'Repository not connected', 400);

    const repo = await fetchJson(`https://api.github.com/repos/${fullName}`);
    const commits = await fetchJson(`https://api.github.com/repos/${fullName}/commits?per_page=10`);
    const contributors = await fetchJson(`https://api.github.com/repos/${fullName}/contributors?per_page=20`);

    team.project.github.open_issues = repo.open_issues_count || 0;
    team.project.github.stars = repo.stargazers_count || 0;
    team.project.github.forks = repo.forks_count || 0;
    team.project.github.contributors_count = Array.isArray(contributors) ? contributors.length : 0;
    team.project.github.recent_commits = (Array.isArray(commits) ? commits : []).map((c) => ({
      sha: c.sha,
      message: c.commit?.message || '',
      author: c.commit?.author?.name || c.author?.login || 'Unknown',
      date: c.commit?.author?.date || null,
    }));
    team.project.github.last_synced_at = new Date();

    await team.save();

    return apiResponse.success(res, team.project.github, 'Repository synced');
  } catch (error) {
    return apiResponse.error(res, error.message || 'Failed to sync repository', 400);
  }
};

exports.getGithubRepoData = async (req, res, next) => {
  try {
    const authorized = await authorizeTeamAccess(req.user, req.params.teamId);
    if (authorized.error) return apiResponse.error(res, authorized.error[1], authorized.error[0]);
    const { team } = authorized;
    return apiResponse.success(res, { team_name: team.team_name, github: team.project.github || {} });
  } catch (error) { return next(error); }
};
