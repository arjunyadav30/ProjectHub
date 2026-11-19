const test = require('node:test');
const assert = require('node:assert/strict');
const { pruneWindow, consumeHit, createRateLimiter } = require('../utils/rateWindow');

test('pruneWindow drops timestamps outside the window', () => {
  const now = 100000;
  assert.deepEqual(pruneWindow([now - 5000, now - 2000, now - 500], { now, windowMs: 1000 }), [now - 500]);
});

test('consumeHit allows up to the limit and then blocks', () => {
  const now = 1000;
  const first = consumeHit([], { now, windowMs: 60000, limit: 2 });
  const second = consumeHit(first.hits, { now: now + 1, windowMs: 60000, limit: 2 });
  const third = consumeHit(second.hits, { now: now + 2, windowMs: 60000, limit: 2 });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfterMs > 0);
  assert.equal(third.hits.length, 2);
});

test('consumeHit allows again after the window slides', () => {
  const result = consumeHit([1000, 2000], { now: 70000, windowMs: 60000, limit: 2 });
  assert.equal(result.allowed, true);
  assert.equal(result.hits.length, 1);
});

test('createRateLimiter keeps keys independent and reports retry time', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 10000 });
  assert.equal(limiter.check('a', 0).allowed, true);
  assert.equal(limiter.check('b', 0).allowed, true);
  const blocked = limiter.check('a', 1000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 9000);
  assert.equal(limiter.check('a', 10001).allowed, true);
});
