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

module.exports = { DEFAULT_EVAL_WEIGHTS, COMPONENT_KEYS, sanitizeWeights, computeFinalScore };
