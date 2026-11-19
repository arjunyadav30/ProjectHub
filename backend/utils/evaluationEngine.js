/**
 * Unified evaluation engine: combines component scores (each 0..100 or null) into one explainable final score.
 * Missing components are excluded and the remaining weights are re-normalized, and the result is flagged partial.
 */
const DEFAULT_EVAL_WEIGHTS = { presentation: 30, viva: 20, contribution: 20, report: 15, attendance: 15 };
const COMPONENT_KEYS = Object.keys(DEFAULT_EVAL_WEIGHTS);

const sanitizeWeights = (weights = {}) => {
  const out = {};
  COMPONENT_KEYS.forEach((k) => {
    const v = Number(weights[k]);
    out[k] = Number.isFinite(v) && v >= 0 ? v : DEFAULT_EVAL_WEIGHTS[k];
  });
  return out;
};

const computeFinalScore = (components = {}, weights = DEFAULT_EVAL_WEIGHTS) => {
  const w = sanitizeWeights(weights);
  const present = COMPONENT_KEYS.filter((k) => components[k] != null && Number.isFinite(Number(components[k])) && w[k] > 0);
  const missing = COMPONENT_KEYS.filter((k) => w[k] > 0 && !present.includes(k));
  const totalWeight = present.reduce((a, k) => a + w[k], 0);

  const breakdown = COMPONENT_KEYS.map((k) => {
    const score = components[k] != null ? Number(components[k]) : null;
    const used = present.includes(k);
    const effective = used && totalWeight ? (w[k] / totalWeight) * 100 : 0;
    return {
      key: k,
      score: score == null ? null : Number(score.toFixed(1)),
      configured_weight: w[k],
      effective_weight: Number(effective.toFixed(1)),
      points: used ? Number(((score * effective) / 100).toFixed(2)) : 0,
      available: used,
    };
  });

  const final = totalWeight ? breakdown.reduce((a, b) => a + b.points, 0) : null;
  return { final_score: final == null ? null : Number(final.toFixed(1)), breakdown, missing, partial: missing.length > 0 };
};

/** Averages presentation percentages (marks/out_of) and present/absent attendance for a student's mark rows. */
const summarizeMarks = (marks = []) => {
  const percentages = (Array.isArray(marks) ? marks : [])
    .filter((m) => Number(m.out_of) > 0)
    .map((m) => Math.min(100, Math.max(0, (Number(m.marks) / Number(m.out_of)) * 100)));
  const presentation = percentages.length ? Number((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1)) : null;
  const marked = (Array.isArray(marks) ? marks : []).filter((m) => m.attendance === 'present' || m.attendance === 'absent');
  const attendance = marked.length ? Number(((marked.filter((m) => m.attendance === 'present').length / marked.length) * 100).toFixed(1)) : null;
  return { presentation, attendance, count: Array.isArray(marks) ? marks.length : 0 };
};

/** Validates a single student mark entered from the event marks editor. */
const normalizeSingleMark = (input = {}) => {
  const outOf = Number(input.out_of ?? input.marks_out_of);
  const rawMarks = Number(input.marks ?? input.presentation_marks);
  if (!Number.isFinite(outOf) || outOf < 1 || outOf > 1000) return { error: 'out_of must be between 1 and 1000' };
  if (!Number.isFinite(rawMarks) || rawMarks < 0 || rawMarks > outOf) return { error: 'marks must be between 0 and out_of' };
  const attendance = ['present', 'absent', 'not_marked'].includes(input.attendance) ? input.attendance : 'not_marked';
  const label = (String(input.presentation_title || input.marks_label || 'Presentation').trim() || 'Presentation').slice(0, 200);
  return { value: { marks: attendance === 'absent' ? 0 : rawMarks, out_of: outOf, attendance, label } };
};

module.exports = {
  DEFAULT_EVAL_WEIGHTS,
  COMPONENT_KEYS,
  sanitizeWeights,
  computeFinalScore,
  summarizeMarks,
  normalizeSingleMark,
};
