const test = require('node:test');
const assert = require('node:assert/strict');
const { generateSlots, buildTimeGrid } = require('../utils/slotAllocator');
const { buildIcs } = require('../utils/ics');
const { computeFinalScore } = require('../utils/evaluationEngine');

test('time grid skips the lunch break', () => {
  const grid = buildTimeGrid({ dayStart: '12:30', dayEnd: '15:00', slotMinutes: 30, bufferMinutes: 0, breaks: [{ start: '13:00', end: '14:00' }] });
  // 12:30, then lunch (13:00-14:00) is skipped, then 14:00 and 14:30
  assert.deepEqual(grid, [750, 840, 870]);
});

const teams = (n, mentor) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, mentor_id: mentor ? mentor(i) : null }));

test('assigns every team without time overlaps inside a panel', () => {
  const r = generateSlots({ teams: teams(10), panels: [{ id: 'p1', examiner_ids: ['f1'] }], days: ['2026-11-02'], slotMinutes: 15, bufferMinutes: 0 });
  assert.equal(r.assignments.length, 10);
  const s = r.assignments.filter((a) => a.panel_id === 'p1').sort((a, b) => a.start_at - b.start_at);
  for (let i = 1; i < s.length; i += 1) assert.ok(s[i].start_at >= s[i - 1].end_at);
});

test('two panels run in parallel; an examiner on both panels is never double-booked', () => {
  const r = generateSlots({
    teams: teams(6),
    panels: [{ id: 'p1', examiner_ids: ['f1', 'f2'] }, { id: 'p2', examiner_ids: ['f2', 'f3'] }],
    days: ['2026-11-02'], slotMinutes: 15, bufferMinutes: 0,
  });
  assert.equal(r.assignments.length, 6);
  const starts = r.assignments.map((a) => a.start_at.getTime());
  assert.equal(new Set(starts).size, starts.length, 'shared examiner forces sequential slots');
});

test('mentor is never an examiner on their own team panel', () => {
  const r = generateSlots({
    teams: [{ id: 't0', mentor_id: 'f1' }],
    panels: [{ id: 'p1', examiner_ids: ['f1', 'f2'] }, { id: 'p2', examiner_ids: ['f3'] }],
    days: ['2026-11-02'], slotMinutes: 15, bufferMinutes: 0,
  });
  assert.equal(r.assignments[0].panel_id, 'p2');
});

test('reports unscheduled teams when capacity is exhausted', () => {
  const r = generateSlots({ teams: teams(50), panels: [{ id: 'p1', examiner_ids: ['f1'] }], days: ['2026-11-02'], slotMinutes: 30, bufferMinutes: 0 });
  assert.ok(r.unscheduled.length > 0);
  assert.equal(r.unscheduled[0].reason, 'not_enough_slots');
});

test('slot times convert from IST wall clock to UTC', () => {
  const r = generateSlots({ teams: teams(1), panels: [{ id: 'p1', examiner_ids: [] }], days: ['2026-11-02'], dayStart: '09:30', slotMinutes: 15 });
  assert.equal(r.assignments[0].start_at.toISOString(), '2026-11-02T04:00:00.000Z');
});

test('ICS output is a valid calendar envelope', () => {
  const ics = buildIcs([{ uid: 'x1', start: new Date('2026-11-02T04:00:00Z'), end: new Date('2026-11-02T04:15:00Z'), summary: 'Team A, review', location: 'Room 1' }]);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART:20261102T040000Z/);
  assert.match(ics, /SUMMARY:Team A\\, review/);
});

test('final score combines weighted components', () => {
  const r = computeFinalScore({ presentation: 80, viva: 60, contribution: 100, report: 70, attendance: 100 });
  assert.equal(r.final_score, 80 * 0.3 + 60 * 0.2 + 100 * 0.2 + 70 * 0.15 + 100 * 0.15);
  assert.equal(r.partial, false);
});

test('missing components are excluded and weights re-normalized', () => {
  const r = computeFinalScore({ presentation: 80, viva: null, contribution: 100, report: null, attendance: 100 });
  assert.ok(r.partial);
  assert.deepEqual(r.missing.sort(), ['report', 'viva']);
  const sum = r.breakdown.reduce((a, b) => a + b.effective_weight, 0);
  assert.ok(Math.abs(sum - 100) < 0.2);
  assert.equal(computeFinalScore({}).final_score, null);
});

const { buildCriteria, scoreSubmission } = require('../utils/judging');

test('score sheet from labels validates ranges and computes percent', () => {
  const sheet = buildCriteria({}, { labels: [{ _id: 'l1', label: 'Content', marks_out_of: 10 }, { _id: 'l2', label: 'Delivery', marks_out_of: 10 }] });
  assert.equal(sheet.total_out_of, 20);
  const ok = scoreSubmission(sheet, [{ label_id: 'l1', marks: 8 }, { label_id: 'l2', marks: 6 }]);
  assert.equal(ok.total_percent, 70);
  assert.match(scoreSubmission(sheet, [{ label_id: 'l1', marks: 11 }, { label_id: 'l2', marks: 6 }]).error, /between 0 and 10/);
  assert.match(scoreSubmission(sheet, [{ label_id: 'l1', marks: 5 }]).error, /Missing marks/);
});

test('rubric sheet applies weights', () => {
  const sheet = buildCriteria({ rubric: { enabled: true, criteria: [{ _id: 'a', label: 'Tech', marks_out_of: 10, weight_percent: 75 }, { _id: 'b', label: 'Docs', marks_out_of: 10, weight_percent: 25 }] } }, { labels: [] });
  assert.equal(scoreSubmission(sheet, [{ label_id: 'a', marks: 10 }, { label_id: 'b', marks: 0 }]).total_percent, 75);
});

test('falls back to a single Overall criterion', () => {
  const sheet = buildCriteria({ presentation_schedule: { marks_out_of: 50 } }, { labels: [] });
  assert.equal(sheet.criteria[0].label, 'Overall');
  assert.equal(scoreSubmission(sheet, [{ label: 'Overall', marks: 25 }]).total_percent, 50);
});
