/**
 * Score-sheet helpers for the live judge panel (pure).
 * Criteria come from the presentation's labels, else the event rubric, else a single "Overall" criterion.
 */
const round = (n, d = 2) => Number(Number(n).toFixed(d));

const buildCriteria = (event, presentation) => {
  const labels = presentation?.labels || [];
  if (labels.length) {
    return { source: 'labels', total_out_of: labels.reduce((a, l) => a + l.marks_out_of, 0), criteria: labels.map((l) => ({ label_id: l._id, label: l.label, marks_out_of: l.marks_out_of, weight_percent: null })) };
  }
  const rubric = event?.rubric;
  if (rubric?.enabled && rubric.criteria?.length) {
    return { source: 'rubric', total_out_of: 100, criteria: rubric.criteria.map((c) => ({ label_id: c._id, label: c.label, marks_out_of: c.marks_out_of, weight_percent: c.weight_percent })) };
  }
  const out = event?.presentation_schedule?.marks_out_of || 100;
  return { source: 'overall', total_out_of: out, criteria: [{ label_id: null, label: 'Overall', marks_out_of: out, weight_percent: null }] };
};

/** Validates a submission against the sheet. Returns { error } or { criteria, total_percent }. */
const scoreSubmission = (sheet, submitted = []) => {
  if (!Array.isArray(submitted)) return { error: 'criteria must be an array' };
  const byKey = new Map(submitted.map((s) => [String(s.label_id ?? s.label), Number(s.marks)]));
  const rows = [];
  for (const c of sheet.criteria) {
    const key = String(c.label_id ?? c.label);
    const marks = byKey.has(key) ? byKey.get(key) : byKey.get(c.label);
    if (marks === undefined || !Number.isFinite(marks)) return { error: `Missing marks for "${c.label}"` };
    if (marks < 0 || marks > c.marks_out_of) return { error: `Marks for "${c.label}" must be between 0 and ${c.marks_out_of}` };
    rows.push({ label_id: c.label_id, label: c.label, marks: round(marks), marks_out_of: c.marks_out_of, weight: c.weight_percent });
  }
  let percent;
  if (sheet.source === 'rubric') {
    const w = rows.reduce((a, r) => a + (r.weight || 0), 0) || 1;
    percent = rows.reduce((a, r) => a + ((r.weight || 0) * r.marks) / r.marks_out_of, 0) / w * 100;
  } else {
    percent = (rows.reduce((a, r) => a + r.marks, 0) / rows.reduce((a, r) => a + r.marks_out_of, 0)) * 100;
  }
  return { criteria: rows.map(({ weight, ...r }) => r), total_percent: round(percent) };
};

module.exports = { buildCriteria, scoreSubmission };
