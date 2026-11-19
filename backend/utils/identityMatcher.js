/**
 * Suggests which GitHub contributor belongs to which team member.
 * Pure function: the UI auto-applies only 'high'; medium/low need a click.
 */
const { loginFromNoreply } = require('./contributionScore');

const BOT_LOGINS = new Set([
  'dependabot', 'dependabot[bot]', 'github-actions', 'github-actions[bot]',
  'renovate', 'renovate[bot]', 'renovate-bot', 'codecov', 'codecov[bot]',
  'greenkeeper', 'greenkeeper[bot]', 'snyk-bot', 'imgbot', 'imgbot[bot]',
  'pre-commit-ci', 'pre-commit-ci[bot]', 'mergify', 'mergify[bot]',
]);

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'of']);

const isBotLogin = (login = '') => {
  const l = String(login || '').trim().toLowerCase();
  if (!l) return false;
  return l.endsWith('[bot]') || l.endsWith('-bot') || BOT_LOGINS.has(l);
};

const normalizeText = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '');

const tokenize = (value = '') => normalizeText(value)
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter((t) => t && !STOP_WORDS.has(t));

const jaccard = (a, b) => {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  setA.forEach((t) => { if (setB.has(t)) intersection += 1; });
  return intersection / (setA.size + setB.size - intersection);
};

const memberEmailSet = (member) => new Set(
  [member.email, ...(Array.isArray(member.emails) ? member.emails : [])]
    .filter(Boolean)
    .map((e) => String(e).trim().toLowerCase())
);

/** Returns { score, confidence, reasons } or null when the pair is not a plausible match. */
const scorePair = (member, candidate) => {
  const memberLogin = String(member.github_login || '').trim().toLowerCase();
  const candidateLogin = String(candidate.login || '').trim().toLowerCase();
  const candidateEmail = String(candidate.email || '').trim().toLowerCase();

  if (memberLogin && candidateLogin && memberLogin === candidateLogin) {
    return { score: 100, confidence: 'high', reasons: ['GitHub username matches the student profile or saved mapping.'] };
  }

  const noreplyLogin = loginFromNoreply(candidateEmail);
  if (memberLogin && noreplyLogin && memberLogin === noreplyLogin) {
    return { score: 96, confidence: 'high', reasons: ['GitHub noreply email matches the student username.'] };
  }

  if (candidateEmail && memberEmailSet(member).has(candidateEmail)) {
    return { score: 95, confidence: 'high', reasons: ['Email address matches.'] };
  }

  const memberTokens = tokenize(member.name);
  const nameOverlap = jaccard(memberTokens, tokenize(candidate.name));
  const loginOverlap = jaccard(memberTokens, tokenize(candidateLogin));
  const overlap = Math.max(nameOverlap, loginOverlap);

  if (overlap >= 0.6) {
    return {
      score: Math.round(50 + overlap * 40),
      confidence: 'medium',
      reasons: [`Name looks similar (${Math.round(overlap * 100)}% token overlap).`],
    };
  }
  if (overlap >= 0.34) {
    return {
      score: Math.round(20 + overlap * 30),
      confidence: 'low',
      reasons: [`Name is somewhat similar (${Math.round(overlap * 100)}% token overlap).`],
    };
  }
  return null;
};

const suggestMappings = ({ members = [], candidates = [] } = {}) => {
  const ignoredBots = [];
  const usableCandidates = [];
  const candidateByIndex = new Map();
  candidates.forEach((c, index) => {
    const login = String(c?.login || '').trim();
    if (isBotLogin(login)) ignoredBots.push(login || String(c?.email || 'bot'));
    else {
      usableCandidates.push({ candidate: c, index });
      candidateByIndex.set(index, c);
    }
  });

  const pairs = [];
  members.forEach((member, memberIndex) => {
    usableCandidates.forEach(({ candidate, index: candidateIndex }) => {
      const match = scorePair(member, candidate);
      if (match) pairs.push({ memberIndex, candidateIndex, ...match });
    });
  });

  pairs.sort((a, b) => (
    b.score - a.score
    || a.memberIndex - b.memberIndex
    || String(candidateByIndex.get(a.candidateIndex)?.login || '').localeCompare(String(candidateByIndex.get(b.candidateIndex)?.login || ''))
    || a.candidateIndex - b.candidateIndex
  ));

  const usedMembers = new Set();
  const usedCandidates = new Set();
  const suggestions = [];

  pairs.forEach((pair) => {
    if (usedMembers.has(pair.memberIndex) || usedCandidates.has(pair.candidateIndex)) return;
    usedMembers.add(pair.memberIndex);
    usedCandidates.add(pair.candidateIndex);
    const member = members[pair.memberIndex];
    const candidate = candidateByIndex.get(pair.candidateIndex);
    suggestions.push({
      student_id: member.student_id,
      login: candidate.login || loginFromNoreply(candidate.email) || '',
      email: candidate.email || '',
      name: candidate.name || '',
      commits: Number(candidate.commits) || 0,
      confidence: pair.confidence,
      score: pair.score,
      reasons: pair.reasons,
    });
  });

  const unmatchedMembers = members
    .map((m, index) => ({ m, index }))
    .filter(({ index }) => !usedMembers.has(index))
    .map(({ m }) => m.student_id);

  const unmatchedCandidates = usableCandidates
    .filter(({ index }) => !usedCandidates.has(index))
    .map(({ candidate }) => candidate.login || candidate.email || candidate.name || '');

  return {
    suggestions,
    unmatched_members: unmatchedMembers,
    unmatched_candidates: unmatchedCandidates,
    ignored_bots: ignoredBots,
  };
};

module.exports = { suggestMappings, isBotLogin, scorePair, jaccard, tokenize };
