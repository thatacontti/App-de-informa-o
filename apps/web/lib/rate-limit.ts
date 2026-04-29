import { redis } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  attempts: number;
  remaining: number;
  resetSeconds: number;
}

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SEC = 15 * 60; // 15 minutes

/**
 * Token-bucket-style counter keyed by identifier (typically email).
 * Increments on every call, expires the key after the window starts.
 * Returns `allowed: false` once the counter exceeds the limit.
 */
export async function checkLoginRate(identifier: string): Promise<RateLimitResult> {
  const key = `login:attempts:${identifier.toLowerCase()}`;

  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, LOGIN_WINDOW_SEC);

  const ttl = await redis.ttl(key);

  return {
    allowed: attempts <= LOGIN_MAX_ATTEMPTS,
    attempts,
    remaining: Math.max(0, LOGIN_MAX_ATTEMPTS - attempts),
    resetSeconds: ttl > 0 ? ttl : LOGIN_WINDOW_SEC,
  };
}

/** Call after a successful login to clear the lockout counter. */
export async function clearLoginRate(identifier: string): Promise<void> {
  await redis.del(`login:attempts:${identifier.toLowerCase()}`);
}
