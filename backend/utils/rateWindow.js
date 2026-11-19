/**
 * Tiny in-memory sliding-window rate limiter (pure helpers + a small factory).
 * Jobs/limits live in memory and reset on restart.
 */

const pruneWindow = (timestamps = [], { now = Date.now(), windowMs = 600000 } = {}) => (
  timestamps.filter((t) => now - t < windowMs)
);

/**
 * Records one hit if allowed.
 * Returns { allowed, hits, remaining, retryAfterMs }.
 */
const consumeHit = (timestamps = [], { now = Date.now(), windowMs = 600000, limit = 10 } = {}) => {
  const recent = pruneWindow(timestamps, { now, windowMs });
  if (recent.length >= limit) {
    return {
      allowed: false,
      hits: recent,
      remaining: 0,
      retryAfterMs: Math.max(0, windowMs - (now - recent[0])),
    };
  }
  const hits = [...recent, now];
  return { allowed: true, hits, remaining: Math.max(0, limit - hits.length), retryAfterMs: 0 };
};

const createRateLimiter = ({ limit = 10, windowMs = 600000 } = {}) => {
  const store = new Map();
  return {
    check(key, now = Date.now()) {
      const result = consumeHit(store.get(String(key)) || [], { now, windowMs, limit });
      store.set(String(key), result.hits);
      return result;
    },
    reset() { store.clear(); },
  };
};

module.exports = { pruneWindow, consumeHit, createRateLimiter };
