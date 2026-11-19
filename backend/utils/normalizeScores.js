/**
 * Examiner bias normalization (z-score based).
 *
 * Each score: { examinerId, teamId, groupId, value }   (value in percent 0..100)
 * groupId = the panel; examiners in a group should have scored the same teams.
 *
 * normalized = groupMean + ((value - examinerMean) / examinerStd) * groupStd
 *
 * ASSUMPTION: examiners inside a group scored comparable (ideally identical) sets of teams.
 * Strictness differences BETWEEN panels are not corrected (panels may truly have different team quality).
 * Examiners with too few scores, or zero spread, fall back to raw scores and are flagged.
 */
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
const round = (n, d = 2) => Number(n.toFixed(d));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const normalizeExaminerScores = (scores = [], { minPerExaminer = 3, epsilon = 1e-6 } = {}) => {
  const byGroup = new Map();
  scores.forEach((s) => {
    const g = String(s.groupId ?? 'default');
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(s);
  });

  const examinerStats = [];
  const normalizedRows = [];

  byGroup.forEach((groupScores, groupId) => {
    const gMean = mean(groupScores.map((s) => s.value));
    const gStd = std(groupScores.map((s) => s.value));

    const byExaminer = new Map();
    groupScores.forEach((s) => {
      const k = String(s.examinerId);
      if (!byExaminer.has(k)) byExaminer.set(k, []);
      byExaminer.get(k).push(s);
    });

    byExaminer.forEach((rows, examinerId) => {
      const values = rows.map((r) => r.value);
      const eMean = mean(values);
      const eStd = std(values);
      const usable = rows.length >= minPerExaminer && eStd > epsilon && gStd > epsilon;
      examinerStats.push({
        examinerId,
        groupId,
        count: rows.length,
        mean: round(eMean),
        std: round(eStd),
        leniency: round(eMean - gMean), // + lenient, - strict (vs. panel average)
        method: usable ? 'z_score' : 'raw_fallback',
        reason: usable ? null : (rows.length < minPerExaminer ? 'too_few_scores' : 'no_spread'),
      });
      rows.forEach((r) => {
        const normalized = usable ? gMean + ((r.value - eMean) / eStd) * gStd : r.value;
        normalizedRows.push({ ...r, raw: r.value, normalized: round(clamp(normalized, 0, 100)), method: usable ? 'z_score' : 'raw_fallback' });
      });
    });
  });

  // Aggregate per team.
  const byTeam = new Map();
  normalizedRows.forEach((r) => {
    const k = String(r.teamId);
    if (!byTeam.has(k)) byTeam.set(k, []);
    byTeam.get(k).push(r);
  });
  const teams = [...byTeam.entries()].map(([teamId, rows]) => ({
    teamId,
    examiners: rows.length,
    raw_mean: round(mean(rows.map((r) => r.raw))),
    normalized_mean: round(mean(rows.map((r) => r.normalized))),
    raw_scores: rows.map((r) => ({ examinerId: String(r.examinerId), value: r.raw, normalized: r.normalized, method: r.method })),
  }));

  const rank = (key) => [...teams].sort((a, b) => b[key] - a[key]).map((t, i) => [t.teamId, i + 1]);
  const rawRank = new Map(rank('raw_mean'));
  const normRank = new Map(rank('normalized_mean'));
  teams.forEach((t) => { t.raw_rank = rawRank.get(t.teamId); t.normalized_rank = normRank.get(t.teamId); });
  teams.sort((a, b) => a.normalized_rank - b.normalized_rank);

  return { teams, examiner_stats: examinerStats };
};

module.exports = { normalizeExaminerScores };
