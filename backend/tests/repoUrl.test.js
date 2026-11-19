const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRepoUrl } = require('../utils/repoUrl');

const ok = (input, fullName, extra = {}) => {
  const out = normalizeRepoUrl(input);
  assert.equal(out.ok, true, `${input} should be accepted (${out.error})`);
  assert.equal(out.full_name, fullName);
  assert.equal(out.canonical_url, `https://github.com/${fullName}`);
  Object.entries(extra).forEach(([key, value]) => assert.equal(out[key], value));
};

const bad = (input) => {
  const out = normalizeRepoUrl(input);
  assert.equal(out.ok, false, `${JSON.stringify(input)} should be rejected`);
  assert.ok(out.error);
};

test('accepts canonical GitHub URL forms', () => {
  ok('https://github.com/alice/project', 'alice/project');
  ok('https://github.com/alice/project.git', 'alice/project');
  ok('https://github.com/alice/project/', 'alice/project');
  ok('https://www.github.com/alice/project', 'alice/project');
  ok('http://github.com/alice/project', 'alice/project');
  ok('github.com/alice/project', 'alice/project');
  ok('www.github.com/alice/project', 'alice/project');
});

test('strips tree, blob, pull and query suffixes', () => {
  ok('https://github.com/alice/project/tree/main', 'alice/project', { branch: 'main' });
  ok('https://github.com/alice/project/tree/feature/login', 'alice/project', { branch: 'feature/login' });
  ok('https://github.com/alice/project/blob/main/src/app.js', 'alice/project', { branch: 'main' });
  ok('https://github.com/alice/project/pull/12', 'alice/project', { branch: null });
  ok('https://github.com/alice/project?tab=readme-ov-file', 'alice/project');
  ok('https://github.com/alice/project/issues/3#comment', 'alice/project');
});

test('accepts SSH and shorthand forms', () => {
  ok('git@github.com:alice/project.git', 'alice/project');
  ok('git@github.com:alice/project', 'alice/project');
  ok('alice/project', 'alice/project');
  ok('alice/project.git', 'alice/project');
  ok('alice/project/tree/main', 'alice/project', { branch: 'main' });
  ok('github.com/alice/project.git?foo=bar', 'alice/project');
});

test('rejects other hosts, invalid names and reserved paths', () => {
  bad('');
  bad('   ');
  bad('not a repository');
  bad('https://gitlab.com/alice/project');
  bad('gitlab.com/alice/project');
  bad('https://bitbucket.org/alice/project');
  bad('https://github.com/alice');
  bad('_alice/project');
  bad('alice/pro ject');
  bad('settings/profile');
  bad('https://github.com/settings/profile');
  bad('orgs/acme');
  bad('alice/..');
  bad('alice/');
});

test('preserves case while normalizing the URL', () => {
  ok('https://github.com/Alice/MyProject', 'Alice/MyProject');
  assert.equal(normalizeRepoUrl('https://github.com/Alice/MyProject').canonical_url, 'https://github.com/Alice/MyProject');
});
