const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeMarks, normalizeSingleMark } = require('../utils/evaluationEngine');

test('summarizeMarks averages presentation percentages and attendance', () => {
  const summary = summarizeMarks([
    { marks: 8, out_of: 10, attendance: 'present' },
    { marks: 5, out_of: 10, attendance: 'absent' },
  ]);
  assert.equal(summary.presentation, 65);
  assert.equal(summary.attendance, 50);
  assert.equal(summary.count, 2);
});

test('summarizeMarks returns nulls for an empty list', () => {
  assert.deepEqual(summarizeMarks([]), { presentation: null, attendance: null, count: 0 });
  assert.deepEqual(summarizeMarks(), { presentation: null, attendance: null, count: 0 });
});

test('summarizeMarks clamps percentages and ignores untouched attendance', () => {
  const summary = summarizeMarks([{ marks: 15, out_of: 10, attendance: 'not_marked' }]);
  assert.equal(summary.presentation, 100);
  assert.equal(summary.attendance, null);
});

test('normalizeSingleMark accepts a valid mark', () => {
  const result = normalizeSingleMark({ marks: 18, out_of: 20, attendance: 'present', presentation_title: 'Mid Review' });
  assert.deepEqual(result.value, { marks: 18, out_of: 20, attendance: 'present', label: 'Mid Review' });
});

test('normalizeSingleMark forces absent students to zero', () => {
  const result = normalizeSingleMark({ presentation_marks: 12, marks_out_of: 20, attendance: 'absent' });
  assert.equal(result.value.marks, 0);
  assert.equal(result.value.attendance, 'absent');
});

test('normalizeSingleMark rejects out-of-range input', () => {
  assert.match(normalizeSingleMark({ marks: 21, out_of: 20 }).error, /marks must be/);
  assert.match(normalizeSingleMark({ marks: 5, out_of: 0 }).error, /out_of must be/);
  assert.match(normalizeSingleMark({ marks: -1, out_of: 10 }).error, /marks must be/);
  assert.match(normalizeSingleMark({ marks: 'x', out_of: 10 }).error, /marks must be/);
});
