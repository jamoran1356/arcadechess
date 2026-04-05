/**
 * In-memory sliding-window rate limiter.
 * Each key (ip or userId) keeps a list of timestamps.
 * When the list exceeds `max` within `windowMs`, the request is rejected.
 */

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

// Periodic cleanup every 60s to avoid unbounded memory growth
const CLEANUP_INTERVAL = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, CLEANUP_INTERVAL);
  // Allow the process to exit
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check whether `key` is within the allowed rate.
 * @param key   unique identifier (e.g. `ip:1.2.3.4` or `user:abc123`)
 * @param max   maximum number of requests in the window
 * @param windowMs   window duration in milliseconds
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  ensureCleanup();
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= max) {
    const oldest = entry.timestamps[0]!;
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - oldest) };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: max - entry.timestamps.length, retryAfterMs: 0 };
}
