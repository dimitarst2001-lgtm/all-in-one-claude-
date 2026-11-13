import "server-only";

import { serverEnv } from "@/lib/env/server";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export interface RateLimiter {
  /** Counts one hit for `key` and reports whether it is within `limit` per `windowSeconds`. */
  hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult>;
}

/**
 * Fixed-window limiter kept in process memory. Suitable for development and
 * single-instance use only: serverless instances do not share memory.
 */
class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  async hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + windowSeconds * 1000 };
    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (this.buckets.size > 10_000) {
      for (const [k, v] of this.buckets)
        if (v.resetAt <= now) this.buckets.delete(k);
    }

    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }
}

/**
 * Fixed-window limiter on Upstash Redis via its REST API (INCR + EXPIRE NX in
 * one pipeline). Shared across all serverless instances.
 */
class UpstashRateLimiter implements RateLimiter {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
    const redisKey = `rl:${key}:${windowId}`;
    const resetAt = (windowId + 1) * windowSeconds * 1000;

    try {
      const response = await fetch(`${this.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["EXPIRE", redisKey, String(windowSeconds), "NX"],
        ]),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Upstash responded ${response.status}`);
      const [incr] = (await response.json()) as [{ result: number }, unknown];
      const count = Number(incr.result);
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt,
      };
    } catch (error) {
      // Fail open so an outage of the limiter does not lock everyone out;
      // Supabase Auth keeps its own server-side limits as a second layer.
      console.error("[rate-limit] Upstash error, allowing request", error);
      return { allowed: true, remaining: limit, resetAt };
    }
  }
}

let limiter: RateLimiter | undefined;

export function getRateLimiter(): RateLimiter {
  if (!limiter) {
    const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } =
      serverEnv;
    limiter =
      url && token
        ? new UpstashRateLimiter(url, token)
        : new MemoryRateLimiter();
  }
  return limiter;
}

export const rateLimits = {
  signIn: { limit: 10, windowSeconds: 600 },
  signUp: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
} as const;
