import { GameError } from "./errors";

export type RateLimitDecision = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export type RateLimiter = {
  limit(key: string): Promise<RateLimitDecision>;
};

type Bucket = { timestamps: number[] };

const memoryBuckets = new Map<string, Bucket>();
const upstashLimiters = new Map<string, RateLimiter>();

function memoryLimit(limit: number, windowMs: number, key: string): RateLimitDecision {
  const now = Date.now();
  const bucket = memoryBuckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((stamp) => now - stamp < windowMs);

  if (bucket.timestamps.length >= limit) {
    const reset = (bucket.timestamps[0] ?? now) + windowMs;
    memoryBuckets.set(key, bucket);
    return { success: false, limit, remaining: 0, reset };
  }

  bucket.timestamps.push(now);
  memoryBuckets.set(key, bucket);

  if (memoryBuckets.size > 5000) {
    const oldest = memoryBuckets.keys().next().value;
    if (oldest) memoryBuckets.delete(oldest);
  }

  const reset = (bucket.timestamps[0] ?? now) + windowMs;
  return {
    success: true,
    limit,
    remaining: limit - bucket.timestamps.length,
    reset,
  };
}

function hasUpstash() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashLimiter(limit: number, windowMs: number, prefix: string): Promise<RateLimiter> {
  const cacheKey = `${prefix}:${limit}:${windowMs}`;
  const cached = upstashLimiters.get(cacheKey);
  if (cached) return cached;

  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");
  const seconds = Math.max(1, Math.round(windowMs / 1000));
  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, `${seconds} s`),
    prefix: `cyberpizza:${prefix}`,
    analytics: false,
  });

  const adapter: RateLimiter = {
    async limit(key: string) {
      const result = await ratelimit.limit(key);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    },
  };
  upstashLimiters.set(cacheKey, adapter);
  return adapter;
}

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  prefix: string;
}): RateLimiter {
  return {
    async limit(key: string) {
      if (hasUpstash()) {
        const limiter = await upstashLimiter(options.limit, options.windowMs, options.prefix);
        return limiter.limit(key);
      }
      return memoryLimit(options.limit, options.windowMs, `${options.prefix}:${key}`);
    },
  };
}

export async function enforceLimit(limiter: RateLimiter, key: string) {
  const result = await limiter.limit(key);
  if (!result.success) {
    throw new GameError(429, "rate_limited", "Too many requests. Wait a moment and try again.", {
      reset: result.reset,
    });
  }
}

export function clientKey(request: Request, address?: string) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return address ? `${address}:${ip}` : ip;
}

export const authLimiter = createRateLimiter({ limit: 10, windowMs: 60_000, prefix: "auth" });
export const stateLimiter = createRateLimiter({ limit: 60, windowMs: 60_000, prefix: "state" });
export const collectLimiter = createRateLimiter({ limit: 40, windowMs: 60_000, prefix: "collect" });
export const bakeLimiter = createRateLimiter({ limit: 15, windowMs: 60_000, prefix: "bake" });
export const claimLimiter = createRateLimiter({ limit: 10, windowMs: 60_000, prefix: "claim" });
