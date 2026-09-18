import { getRedis, isCacheReady } from "../config/redis";
import logger from "../utils/logger";

/**
 * The counting layer behind the rate limit middleware.
 *
 * Two stores live here and the caller never has to care which one answered:
 *
 *  - redis, when REDIS_URL is configured and the socket is usable. This is the
 *    only correct store once the api runs as more than one container, because
 *    a per-process counter lets an attacker multiply their allowance by the
 *    number of replicas behind nginx.
 *  - an in-process map, used when redis is absent or down. It is weaker
 *    (per-process, lost on restart) but it is strictly better than no limit at
 *    all, and it keeps local development working with no extra services.
 *
 * Both implement a fixed window: the first request of a window sets the
 * counter and the expiry, every later request in that window increments it.
 * A sliding window would be smoother at the boundary, but a fixed window is
 * one atomic redis round trip and the burst it allows (2x the limit across a
 * window edge) is irrelevant at the thresholds we set.
 */

export interface IRateLimitResult {
  /** requests already made in the current window, including this one */
  count: number;
  /** seconds until the window resets */
  resetSeconds: number;
}

/** in-memory fallback store */
interface IMemoryEntry {
  count: number;
  /** epoch ms at which the window ends */
  expiresAt: number;
}

const memoryStore = new Map<string, IMemoryEntry>();

/**
 * Without this the map grows one entry per distinct key forever, which on an
 * ip-keyed limiter is a slow memory leak with an attacker holding the tap.
 * Sweeping every minute is cheap: the map only holds live windows, and every
 * window here is minutes long at most.
 */
const MEMORY_SWEEP_INTERVAL_MS = 60_000;

const sweepMemoryStore = () => {
  const now = Date.now();

  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
};

const sweepTimer = setInterval(sweepMemoryStore, MEMORY_SWEEP_INTERVAL_MS);

// A stray timer must not be the reason the process refuses to exit.
sweepTimer.unref?.();

const hitMemory = (key: string, windowSeconds: number): IRateLimitResult => {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.expiresAt <= now) {
    const expiresAt = now + windowSeconds * 1000;
    memoryStore.set(key, { count: 1, expiresAt });
    return { count: 1, resetSeconds: windowSeconds };
  }

  existing.count += 1;

  return {
    count: existing.count,
    resetSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
  };
};

/**
 * INCR, arm the expiry only when this request created the counter, and read
 * the remaining ttl — as one script, so it is a single round trip and no two
 * concurrent requests can interleave between the steps.
 *
 * The expiry is deliberately not re-armed on every hit. Re-arming turns the
 * fixed window into a rolling one that never resets while traffic keeps
 * arriving, and a client sitting just over the limit would stay blocked
 * forever instead of for one window.
 *
 * A script is used instead of EXPIRE ... NX because that flag only exists from
 * redis 7, and this has to keep working on whatever the deploy is running.
 */
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`;

const hitRedis = async (
  key: string,
  windowSeconds: number,
): Promise<IRateLimitResult | null> => {
  const redis = getRedis();

  if (!redis) return null;

  /**
   * The key is passed unprefixed. ioredis applies its configured keyPrefix to
   * the declared KEYS of an eval just as it does for ordinary commands, so
   * adding it here too would write llc:llc:rl:... and the limiter would never
   * find its own counters from anywhere else.
   */
  const [count, ttlMs] = (await redis.eval(
    HIT_SCRIPT,
    1,
    key,
    windowSeconds * 1000,
  )) as [number, number];

  if (typeof count !== "number") return null;

  return {
    count,
    // A key with no ttl (-1) or already gone (-2) must not report a nonsense
    // reset, so fall back to the full window.
    resetSeconds:
      ttlMs > 0 ? Math.max(1, Math.ceil(ttlMs / 1000)) : windowSeconds,
  };
};

/**
 * Record one request against `key` and report where it lands in the window.
 *
 * Returns null when the request could not be counted at all. The middleware
 * reads that as "let it through": a rate limiter that 500s when redis hiccups
 * would convert a cache outage into a full site outage, which is a far worse
 * failure than briefly not counting requests. The in-memory store means this
 * only ever happens on an unexpected error, not on a missing redis.
 */
export const consumeRateLimit = async (
  key: string,
  windowSeconds: number,
): Promise<IRateLimitResult | null> => {
  if (isCacheReady()) {
    try {
      const result = await hitRedis(key, windowSeconds);

      if (result) return result;
    } catch (error) {
      logger.error({
        message: "Rate limit redis error, falling back to memory store",
        error: (error as Error)?.message,
        key,
      });
    }
  }

  try {
    return hitMemory(key, windowSeconds);
  } catch (error) {
    logger.error({
      message: "Rate limit memory store error, allowing request",
      error: (error as Error)?.message,
      key,
    });
    return null;
  }
};

/** test / admin helper : wipe the in-process counters */
export const resetMemoryRateLimits = () => memoryStore.clear();
