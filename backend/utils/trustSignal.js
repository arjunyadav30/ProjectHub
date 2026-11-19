/**
 * Compares the Git-based contribution score with the commit-grounded viva score.
 * This is an evidence-based flag for the guide, NOT proof of misconduct.
 */
const buildTrustSignal = ({ gitScore, vivaScore, gap = 30 }) => {
  if (gitScore == null || vivaScore == null) {
    return { level: 'insufficient_data', gap: null, message: 'Need both a contribution score and a completed commit-grounded viva.' };
  }
  const diff = Math.round(gitScore - vivaScore);
  if (diff >= gap) {
    return { level: 'verify', gap: diff, message: 'High Git contribution but weak explanation of own commits. Suggest the guide reviews this student in person.' };
  }
  if (diff <= -gap) {
    return { level: 'check_mapping', gap: diff, message: 'Strong viva but low Git contribution. Check the GitHub identity mapping or work done outside Git.' };
  }
  return { level: 'consistent', gap: diff, message: 'Git contribution and viva performance are consistent.' };
};

module.exports = { buildTrustSignal };
