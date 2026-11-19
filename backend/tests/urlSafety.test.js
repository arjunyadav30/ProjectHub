const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { isPrivateIp, parsePublicHttpUrl } = require('../utils/urlSafety');
const { checkUrl } = require('../utils/healthCheck');
const { heuristicScoreAnswer, selectCommitsForViva, parseQuestions, parseScores, fallbackQuestions, buildCommitContext } = require('../utils/commitViva');

test('private and special IPs are rejected', () => {
  ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1', '0.0.0.0'].forEach((ip) => assert.equal(isPrivateIp(ip), true, ip));
  ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'].forEach((ip) => assert.equal(isPrivateIp(ip), false, ip));
});

test('url parser blocks bad schemes, credentials and local hosts', () => {
  ['file:///etc/passwd', 'ftp://x.com', 'http://user:pw@example.com', 'http://localhost:3000', 'http://169.254.169.254/latest', 'http://app.internal'].forEach((u) => assert.throws(() => parsePublicHttpUrl(u), u));
  assert.equal(parsePublicHttpUrl('https://my-app.onrender.com').hostname, 'my-app.onrender.com');
});

test('checkUrl refuses loopback targets (SSRF) without making a request', async () => {
  const r = await checkUrl('http://127.0.0.1:9/');
  assert.equal(r.status, 'down');
  assert.match(r.error, /Private|private/);
});

test('checkUrl reports up/slow/down against a local server (lookup override for test only)', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/ok') { res.writeHead(200); res.end('ok'); }
    else if (req.url === '/slow') setTimeout(() => { res.writeHead(200); res.end('ok'); }, 150);
    else if (req.url === '/redir') { res.writeHead(302, { Location: '/ok' }); res.end(); }
    else { res.writeHead(500); res.end('err'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  // Test-only: bypass the private-IP guard so we can hit localhost; parsePublicHttpUrl would block 'localhost', so use the IP form via a hostname-less URL override.
  const dns = require('node:dns');
  const passLookup = (h, o, cb) => dns.lookup(h, o, cb);
  const mod = require('../utils/urlSafety');
  const original = mod.parsePublicHttpUrl;
  assert.ok(original); // guard stays in place for production paths
  const { URL } = require('node:url');
  const direct = async (path, opts) => {
    // Re-implement the minimal path: call requestOnce through checkUrl by temporarily using a public-looking host that resolves locally.
    const u = new URL(`http://example.test:${port}${path}`);
    return checkUrl(u.toString(), { lookup: (h, o, cb) => cb(null, o && o.all ? [{ address: '127.0.0.1', family: 4 }] : '127.0.0.1', 4), ...opts });
  };
  assert.equal((await direct('/ok')).status, 'up');
  assert.equal((await direct('/redir')).status, 'up');
  assert.equal((await direct('/slow', { slowMs: 50 })).status, 'slow');
  const bad = await direct('/boom');
  assert.equal(bad.status, 'down');
  assert.equal(bad.http_status, 500);
  server.close();
  void passLookup;
});

const sampleCommit = (sha, file, add) => ({ sha, message: `Implement ${file} logic`, date: '2026-09-01T00:00:00Z', parents: ['p'], files: [{ filename: file, additions: add, deletions: 0, patch: '+ const token = jwt.sign(payload)' }] });

test('commit selection prefers larger, distinct-file commits and skips tiny ones', () => {
  const picked = selectCommitsForViva([sampleCommit('a', 'src/auth.js', 80), sampleCommit('b', 'src/auth.js', 60), sampleCommit('c', 'src/db.js', 40), sampleCommit('d', 'src/x.js', 2)], 3);
  assert.deepEqual(picked.map((c) => c.sha), ['a', 'c', 'b']);
});

test('AI question parser drops invented commit shas and weak items', () => {
  const ctxs = [buildCommitContext(sampleCommit('abc1234', 'src/auth.js', 80))];
  const out = parseQuestions({ questions: [
    { commit_sha: 'abc1234', question: 'Why JWT?', expected_points: ['stateless', 'expiry'] },
    { commit_sha: 'fake', question: 'Q', expected_points: ['a', 'b'] },
    { commit_sha: 'abc1234', question: 'Only one point', expected_points: ['a'] },
  ] }, ctxs);
  assert.equal(out.length, 1);
  assert.equal(out[0].commit_sha, 'abc1234');
});

test('AI score parser clamps and ignores malformed entries', () => {
  const s = parseScores({ scores: [{ index: 0, score: 99, feedback: 'x' }, { index: 5, score: 3 }, { index: 1, score: 'bad' }] }, 2);
  assert.equal(s[0].score, 10);
  assert.equal(s[1], null);
});

test('heuristic scoring rewards specific answers over padding', () => {
  const q = fallbackQuestions([buildCommitContext(sampleCommit('abc1234', 'src/auth.js', 80))])[0];
  const empty = heuristicScoreAnswer('', q).score;
  const filler = heuristicScoreAnswer('a '.repeat(150), q).score;
  const good = heuristicScoreAnswer('This change states the purpose of the auth change: it explains how the code works with jwt sign in auth, notes a trade-off versus sessions, and covers testing and failure cases.', q).score;
  assert.equal(empty, 0);
  assert.ok(good > filler);
});
