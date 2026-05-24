const Team = require('../models/Team');
const apiResponse = require('../utils/apiResponse');

const parseRepo = (repoUrl = '') => {
  const clean = String(repoUrl || '').trim().replace(/\.git$/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
};

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': 'ProjectHub-App' } });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json();
};

exports.connectGithubRepo = async (req, res, next) => {
  try {
    const { repo_url } = req.body;
    if (!repo_url) return apiResponse.error(res, 'repo_url is required', 400);

    const team = await Team.findById(req.params.teamId);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const fullName = parseRepo(repo_url);
    if (!fullName) return apiResponse.error(res, 'Invalid repository URL', 400);

    team.project.github.repo_url = repo_url;
    team.project.github.repo_full_name = fullName;
    await team.save();

    return apiResponse.success(res, team.project.github, 'Repository connected');
  } catch (error) { return next(error); }
};

exports.syncGithubRepo = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

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
    const team = await Team.findById(req.params.teamId).select('project.github team_name');
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    return apiResponse.success(res, { team_name: team.team_name, github: team.project.github || {} });
  } catch (error) { return next(error); }
};
