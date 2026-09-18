import Redis from "ioredis";
import logger from "../utils/logger";

/**
 * The cache is optional infrastructure. If REDIS_URL is not set the whole
 * caching layer turns itself off and every request goes straight to postgres,
 * which is exactly how the api behaved before this existed — so local setups
 * and deployments without a redis container keep working untouched.
 */

let client: Redis | null = null;
let initialised = false;

/**
 * Built on first use, never at import time.
 *
 * index.ts calls dotenv.config() in its module body, but every import in that
 * file is hoisted above it. A client constructed at import time would read a
 * REDIS_URL that is still undefined and silently disable the cache in
 * production. Deferring until the first request means the env is loaded.
 */
export const getRedis = (): Redis | null => {
  if (initialised) return client;
  initialised = true;

  const url = process.env.REDIS_URL;

  if (!url) {
    logger.info({
      message: "REDIS_URL is not set, response caching is disabled",
    });
    return null;
  }

  client = new Redis(url, {
    // Commands issued while the socket is down fail immediately instead of
    // queueing and resolving minutes later, when the caller is long gone.
    enableOfflineQueue: false,
    // A request must never wait on a dead cache. maxRetriesPerRequest only
    // covers the reconnect case; commandTimeout covers the nastier one, where
    // the socket is up and redis simply never answers (a blocked or swapping
    // server). Without it a stalled redis stalls every request behind it.
    maxRetriesPerRequest: 1,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT_MS ?? "300"),
    // Back off gently, and cap it, so an outage does not become a reconnect
    // storm.
    retryStrategy: (times) => Math.min(times * 200, 5000),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? "llc:",
  });

  client.on("connect", () => {
    logger.info({ message: "Redis connected" });
  });

  // Without a listener ioredis emits an unhandled 'error' event, which takes
  // the whole process down the first time redis blips.
  client.on("error", (error: Error) => {
    logger.error({ message: "Redis error", error: error?.message });
  });

  return client;
};

/**
 * True only when a client exists AND its socket is usable right now. Callers
 * use this to skip the cache entirely rather than paying for a command that is
 * going to be rejected anyway.
 */
export const isCacheReady = () => {
  const redis = getRedis();
  return redis !== null && redis.status === "ready";
};
