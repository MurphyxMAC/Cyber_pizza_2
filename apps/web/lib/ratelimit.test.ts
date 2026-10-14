import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter } from "./ratelimit";

test("in-memory limiter blocks once the window is full", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, prefix: `test-${Date.now()}` });
  const key = "player";

  const first = await limiter.limit(key);
  const second = await limiter.limit(key);
  const third = await limiter.limit(key);

  assert.equal(first.success, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.success, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.success, false);
  assert.equal(third.remaining, 0);
});
