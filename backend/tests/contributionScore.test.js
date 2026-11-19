const test = require('node:test');
const assert = require('node:assert/strict');
const { computeContribution, isIgnoredPath, messageQuality, parseGithubLogin, loginFromNoreply } = require('../utils/contributionScore');
const { buildTrustSignal } = require('../utils/trustSignal');

const members = [
  { student_id: 'a', name: 'A', github_login: 'alice', emails: [] },
  { student_id: 'b', name: 'B', github_login: 'bob', emails: ['bob@college.edu'] },
];
const commit = (over) => ({ sha: Math.random().toString(16).slice(2), message: 'Add login validation', date: '2026-09-10T10:00:00Z', parents: ['p'], files: [{ filename: 'src/a.js', additions: 50, deletions: 10 }], ...over });

test('ignores lockfiles and generated paths', () => {
  assert.equal(isIgnoredPath('package-lock.json'), true);
  assert.equal(isIgnoredPath('frontend/dist/app.min.js'), true);
  assert.equal(isIgnoredPath('src/App.jsx'), false);
});

test('parses github logins and noreply emails', () => {
  assert.equal(parseGithubLogin('https://github.com/Alice-Dev/'), 'alice-dev');
  assert.equal(parseGithubLogin('bob'), 'bob');
  assert.equal(loginFromNoreply('123+carol@users.noreply.github.com'), 'carol');
});

test('shares sum to ~100 and reflect effective lines, not lockfile noise', () => {
  const commits = [
    commit({ author_login: 'alice' }),
    commit({ author_login: 'alice' }),
    commit({ author_email: 'bob@college.edu', files: [{ filename: 'package-lock.json', additions: 5000, deletions: 0 }, { filename: 'src/b.js', additions: 10, deletions: 0 }] }),
  ];
  const r = computeContribution({ commits, members });
  const total = r.members.reduce((a, m) => a + m.share_percent, 0);
  assert.ok(Math.abs(total - 100) < 0.5);
  const alice = r.members.find((m) => m.student_id === 'a');
  const bob = r.members.find((m) => m.student_id === 'b');
  assert.ok(alice.share_percent > bob.share_percent);
  assert.equal(bob.effective_lines, 10);
});

test('merge commits are skipped and unknown authors are reported', () => {
  const commits = [commit({ author_login: 'alice', parents: ['x', 'y'] }), commit({ author_login: 'stranger', author_name: 'Stranger' })];
  const r = computeContribution({ commits, members });
  assert.equal(r.analyzed_commits, 1);
  assert.equal(r.unmapped_authors[0].login, 'stranger');
});

test('member with no mapped commits is flagged and gets low suggested score', () => {
  const r = computeContribution({ commits: [commit({ author_login: 'alice' })], members });
  const bob = r.members.find((m) => m.student_id === 'b');
  assert.ok(bob.flags.includes('no_mapped_commits'));
  assert.equal(bob.suggested_score_100, 0);
});

test('bulk dump flag triggers on one huge commit', () => {
  const big = commit({ author_login: 'alice', files: [{ filename: 'src/big.js', additions: 700, deletions: 0 }] });
  const small = commit({ author_login: 'alice', files: [{ filename: 'src/s.js', additions: 20, deletions: 0 }] });
  const r = computeContribution({ commits: [big, small], members });
  assert.ok(r.members.find((m) => m.student_id === 'a').flags.includes('bulk_dump'));
});

test('no commits at all gives equal shares instead of NaN', () => {
  const r = computeContribution({ commits: [], members });
  assert.equal(r.members[0].share_percent, 50);
});

test('message quality rewards descriptive messages', () => {
  assert.ok(messageQuality('Add JWT refresh token rotation') > messageQuality('update'));
});

test('trust signal flags large gaps in both directions', () => {
  assert.equal(buildTrustSignal({ gitScore: 90, vivaScore: 30 }).level, 'verify');
  assert.equal(buildTrustSignal({ gitScore: 20, vivaScore: 80 }).level, 'check_mapping');
  assert.equal(buildTrustSignal({ gitScore: 70, vivaScore: 65 }).level, 'consistent');
  assert.equal(buildTrustSignal({ gitScore: null, vivaScore: 65 }).level, 'insufficient_data');
});
