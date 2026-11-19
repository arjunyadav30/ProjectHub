const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveStatus } = require('../utils/onboardingStatus');

const mappedMembers = [{ student_id: 's1', github_login: 'alice' }];

test('reports no_repo when nothing is linked', () => {
  const out = deriveStatus({ repo: null, members: mappedMembers, latestReport: null });
  assert.equal(out.status, 'no_repo');
  assert.equal(out.stale, false);
  assert.equal(out.steps.find((s) => s.key === 'repo').done, false);
});

test('reports mapping_needed when a member has no GitHub login', () => {
  const out = deriveStatus({
    repo: { full_name: 'a/b' },
    members: [{ student_id: 's1', github_login: 'alice' }, { student_id: 's2', github_login: '' }],
  });
  assert.equal(out.status, 'mapping_needed');
  assert.equal(out.steps.find((s) => s.key === 'mapping').done, false);
});

test('reports ready when the repo is linked and everyone is mapped', () => {
  const out = deriveStatus({ repo: { full_name: 'a/b' }, members: mappedMembers, latestReport: null });
  assert.equal(out.status, 'ready');
  assert.equal(out.steps.find((s) => s.key === 'ready').done, true);
});

test('reports analyzed after a report exists', () => {
  const out = deriveStatus({
    repo: { full_name: 'a/b' },
    members: mappedMembers,
    latestReport: { created_at: new Date(), guide_decision: { decided_at: null } },
  });
  assert.equal(out.status, 'analyzed');
  assert.equal(out.steps.find((s) => s.key === 'analyzed').done, true);
});

test('reports decided after the guide saves a decision', () => {
  const out = deriveStatus({
    repo: { full_name: 'a/b' },
    members: mappedMembers,
    latestReport: { created_at: new Date(), guide_decision: { decided_at: new Date() } },
  });
  assert.equal(out.status, 'decided');
  assert.equal(out.steps.find((s) => s.key === 'decided').done, true);
});

test('marks reports older than seven days as stale', () => {
  const now = new Date('2026-11-18T00:00:00Z');
  const fresh = deriveStatus({
    repo: { full_name: 'a/b' },
    members: mappedMembers,
    latestReport: { created_at: new Date('2026-11-14T00:00:00Z') },
    now,
  });
  const stale = deriveStatus({
    repo: { full_name: 'a/b' },
    members: mappedMembers,
    latestReport: { created_at: new Date('2026-11-01T00:00:00Z') },
    now,
  });
  assert.equal(fresh.stale, false);
  assert.equal(stale.stale, true);
  assert.equal(stale.status, 'analyzed');
});
