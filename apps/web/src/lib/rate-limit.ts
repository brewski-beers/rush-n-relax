// In-memory sliding-window rate limiter.
//
// LIMITATION: This Map lives in module scope and is NOT shared across
// serverless function instances (Vercel spins up separate processes per
// invocation under load). Each instance enforces the limit independently,
// so a determined attacker can bypass it with parallel requests. It guards
// against accidental hammering and casual abuse — not a hard security barrier.
// For stronger guarantees, back this with a Redis/KV store.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

interface BucketEntry {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, BucketEntry>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = buckets.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // Evict the stale entry before writing the new window so the Map doesn't
    // grow unboundedly when unique IPs accumulate (e.g. a scanning probe).
    if (entry) buckets.delete(ip);
    buckets.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= MAX_REQUESTS) {
    return true;
  }

  entry.count += 1;
  return false;
}
