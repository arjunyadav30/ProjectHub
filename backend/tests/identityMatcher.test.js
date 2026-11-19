const test = require('node:test');
const assert = require('node:assert/strict');
const { suggestMappings, isBotLogin } = require('../utils/identityMatcher');

test('matches exact GitHub logins as high confidence', () => {
  const result = suggestMappings({
    members: [{ student_id: 's1', name: 'Alice Sharma', email: 'alice@college.edu', github_login: 'alice-dev' }],
    candidates: [
      { login: 'alice-dev', email: 'other@example.com', name: 'Alice', commits: 10 },
      { login: 'someone', email: 'x@example.com', name: 'X', commits: 1 },
    ],
  });
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].login, 'alice-dev');
  assert.equal(result.suggestions[0].confidence, 'high');
  assert.equal(result.suggestions[0].score, 100);
  assert.deepEqual(result.unmatched_members, []);
  assert.deepEqual(result.unmatched_candidates, ['someone']);
});

test('matches GitHub noreply emails and plain email addresses as high confidence', () => {
  const result = suggestMappings({
    members: [
      { student_id: 's1', name: 'Bob Verma', email: 'bob@college.edu', github_login: 'bobverma' },
      { student_id: 's2', name: 'Carol Nair', email: 'carol@college.edu', github_login: '' },
    ],
    candidates: [
      { login: 'bobby', email: '12345+bobverma@users.noreply.github.com', name: 'Bob', commits: 6 },
      { login: 'carol-n', email: 'carol@college.edu', name: 'Carol N', commits: 4 },
    ],
  });
  const bob = result.suggestions.find((s) => String(s.student_id) === 's1');
  const carol = result.suggestions.find((s) => String(s.student_id) === 's2');
  assert.equal(bob.confidence, 'high');
  assert.ok(bob.reasons[0].toLowerCase().includes('noreply'));
  assert.equal(carol.confidence, 'high');
  assert.ok(carol.reasons[0].toLowerCase().includes('email'));
});

test('suggests name overlap as medium or low confidence', () => {
  const medium = suggestMappings({
    members: [{ student_id: 's1', name: 'Ravi Kumar', email: '', github_login: '' }],
    candidates: [{ login: 'ravi-kumar', email: '', name: 'Ravi Kumar', commits: 3 }],
  });
  assert.equal(medium.suggestions[0].confidence, 'medium');

  const low = suggestMappings({
    members: [{ student_id: 's1', name: 'Ravi Kumar', email: '', github_login: '' }],
    candidates: [{ login: 'ravi', email: '', name: 'Ravi', commits: 3 }],
  });
  assert.equal(low.suggestions[0].confidence, 'low');
});

test('ignores bot accounts', () => {
  assert.equal(isBotLogin('dependabot[bot]'), true);
  assert.equal(isBotLogin('github-actions'), true);
  assert.equal(isBotLogin('renovate-bot'), true);
  assert.equal(isBotLogin('alice'), false);

  const result = suggestMappings({
    members: [{ student_id: 's1', name: 'Alice', email: '', github_login: '' }],
    candidates: [
      { login: 'dependabot[bot]', email: 'bot@example.com', name: 'dependabot', commits: 20 },
      { login: 'alice', email: '', name: 'Alice', commits: 2 },
    ],
  });
  assert.deepEqual(result.ignored_bots, ['dependabot[bot]']);
  assert.equal(result.suggestions[0].login, 'alice');
});

test('assigns each candidate to at most one member', () => {
  const result = suggestMappings({
    members: [
      { student_id: 's1', name: 'Alice', email: 'alice@x.com', github_login: 'alice' },
      { student_id: 's2', name: 'Alicia', email: 'alicia@x.com', github_login: '' },
    ],
    candidates: [{ login: 'alice', email: 'alice@x.com', name: 'Alice', commits: 9 }],
  });
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].student_id, 's1');
  assert.deepEqual(result.unmatched_members, ['s2']);
});

test('is deterministic for ties', () => {
  const input = {
    members: [
      { student_id: 's2', name: 'Sam Lee', email: '', github_login: '' },
      { student_id: 's1', name: 'Sam Lee', email: '', github_login: '' },
    ],
    candidates: [{ login: 'sam-lee', email: '', name: 'Sam Lee', commits: 1 }],
  };
  const first = suggestMappings(input);
  const second = suggestMappings(input);
  assert.deepEqual(first.suggestions, second.suggestions);
});
