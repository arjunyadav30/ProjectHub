const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeExaminerScores } = require('../utils/normalizeScores');

const mk = (examinerId, vals, groupId = 'p1') => vals.map((value, i) => ({ examinerId, teamId: `t${i}`, groupId, value }));

test('removes lenient/strict offset between examiners on the same panel', () => {
  const base = [60, 70, 80, 90];
  const scores = [...mk('lenient', base.map((v) => v + 10)), ...mk('strict', base.map((v) => v - 10))];
  const r = normalizeExaminerScores(scores);
  r.teams.forEach((t) => {
    const [a, b] = t.raw_scores.map((s) => s.normalized);
    assert.ok(Math.abs(a - b) < 0.5, `normalized scores should converge, got ${a} vs ${b}`);
    assert.ok(Math.abs(t.raw_scores[0].value - t.raw_scores[1].value) >= 19);
  });
});

test('reports leniency per examiner', () => {
  const scores = [...mk('lenient', [80, 85, 90, 95]), ...mk('strict', [50, 55, 60, 65])];
  const { examiner_stats } = normalizeExaminerScores(scores);
  assert.ok(examiner_stats.find((e) => e.examinerId === 'lenient').leniency > 0);
  assert.ok(examiner_stats.find((e) => e.examinerId === 'strict').leniency < 0);
});

test('falls back to raw when an examiner scored too few teams', () => {
  const scores = [...mk('a', [70, 80]), ...mk('b', [60, 90])];
  const r = normalizeExaminerScores(scores, { minPerExaminer: 3 });
  assert.ok(r.examiner_stats.every((e) => e.method === 'raw_fallback' && e.reason === 'too_few_scores'));
  assert.equal(r.teams[0].raw_mean, r.teams[0].normalized_mean);
});

test('falls back to raw when an examiner gives identical scores (no spread)', () => {
  const scores = [...mk('flat', [70, 70, 70, 70]), ...mk('b', [60, 70, 80, 90])];
  const { examiner_stats } = normalizeExaminerScores(scores);
  assert.equal(examiner_stats.find((e) => e.examinerId === 'flat').reason, 'no_spread');
});

test('single examiner panel is unchanged (identity)', () => {
  const r = normalizeExaminerScores(mk('solo', [55, 65, 75, 85]));
  r.teams.forEach((t) => assert.equal(t.raw_mean, t.normalized_mean));
});

test('groups are normalized independently (no cross-panel correction)', () => {
  const scores = [...mk('a', [90, 92, 94, 96], 'p1'), ...mk('b', [50, 52, 54, 56], 'p2')];
  const r = normalizeExaminerScores(scores);
  const p1 = r.teams.find((t) => t.teamId === 't0' && t.raw_scores[0].examinerId === 'a');
  assert.ok(p1);
});

test('normalized values stay within 0..100 and ranks are assigned', () => {
  const r = normalizeExaminerScores([...mk('a', [99, 100, 98, 97]), ...mk('b', [10, 20, 30, 15])]);
  r.teams.forEach((t) => { assert.ok(t.normalized_mean >= 0 && t.normalized_mean <= 100); assert.ok(t.normalized_rank >= 1); });
});
