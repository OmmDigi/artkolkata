import { getRedis, isCacheReady } from "../config/redis";
import logger from "../utils/logger";

/**
 * Every cache entry belongs to one or more tags. A write to a resource wipes
 * its tags, which wipes every response that was built from that resource — so
 * a list, a single item and a facet response all disappear together and none
 * of them can survive as a stale fragment of a resource that has moved on.
 */
export const CACHE_TAGS = {
  PRODUCTS: "products",
  PRODUCT_TAGS: "product-tags",
  CATEGORIES: "categories",
  SUB_CATEGORIES: "sub-categories",
  RECIPIENTS: "recipients",
  REVIEWS: "reviews",
  BLOGS: "blogs",
  SITE_INFO: "site-info",
  SITE_PAGES: "site-pages",
  BANNERS: "banners",
  SHIPPING_RULES: "shipping-rules",
  SITEMAP: "sitemap",
  SERVICEABILITY: "serviceability",
} as const;

export type TCacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

// Chosen to be short enough that an admin edit looks instant to a shopper who
// is already on the page, long enough to absorb a traffic spike.
export const DEFAULT_CACHE_TTL = 300; // seconds

// A tag set must outlive the longest-lived entry it points at, otherwise an
// invalidation would find an empty set and leave live entries behind.
const TAG_SET_TTL_BUFFER = 600; // seconds

// Redis accepts a large argument list, but a single DEL of tens of thousands
// of keys blocks the server. Delete in slices instead.
const DELETE_BATCH_SIZE = 500;

export interface ICachedResponse {
  /** http status of the original response */
  status: number;
  /** verbatim Content-Type header, so xml stays xml and json stays json */
  contentType: string;
  /** the serialised body exactly as it went out the first time */
  body: string;
}

const tagSetKey = (tag: string) => `tag:${tag}`;

/**
 * Read a stored response. Any failure (redis down, corrupt payload) resolves
 * to null, which the caller treats as a plain cache miss — the request then
 * goes to postgres and the customer never sees the outage.
 */
export const getCachedResponse = async (
  key: string,
): Promise<ICachedResponse | null> => {
  const redis = getRedis();

  if (!redis || !isCacheReady()) return null;

  try {
    const raw = await redis.get(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ICachedResponse;

    if (typeof parsed?.body !== "string") return null;

    return parsed;
  } catch (error: any) {
    logger.error({
      message: "Cache read failed",
      key,
      error: error?.message,
    });
    return null;
  }
};

/**
 * Store a response and register its key under every tag it was built from.
 *
 * The SET and the SADDs go out in one pipeline. They are not atomic, but the
 * only ordering that matters is that the key is never live without being
 * registered in its tags, and a pipeline preserves that: redis executes the
 * commands in the order they were queued.
 */
export const setCachedResponse = async ({
  key,
  value,
  ttl = DEFAULT_CACHE_TTL,
  tags,
}: {
  key: string;
  value: ICachedResponse;
  ttl?: number;
  tags: readonly string[];
}) => {
  const redis = getRedis();

  if (!redis || !isCacheReady()) return;

  try {
    const pipeline = redis.pipeline();

    pipeline.set(key, JSON.stringify(value), "EX", ttl);

    tags.forEach((tag) => {
      const setKey = tagSetKey(tag);
      pipeline.sadd(setKey, key);
      pipeline.expire(setKey, ttl + TAG_SET_TTL_BUFFER);
    });

    await pipeline.exec();
  } catch (error: any) {
    logger.error({
      message: "Cache write failed",
      key,
      error: error?.message,
    });
  }
};

/**
 * Drop every cached response registered under any of these tags.
 *
 * Never throws. A write that succeeded in postgres must still report success
 * even if the cache could not be cleared — the entries carry a TTL, so the
 * worst case is a few minutes of staleness rather than a failed admin action.
 */
export const invalidateCacheTags = async (tags: readonly string[]) => {
  const client = getRedis();

  if (!client || !isCacheReady() || tags.length === 0) return;

  try {
    const setKeys = tags.map(tagSetKey);

    // The members are logical keys (no ioredis keyPrefix on them, because they
    // were written as command arguments), so they can be handed straight back
    // to DEL, which re-applies the prefix.
    const memberLists = await Promise.all(
      setKeys.map((setKey) => client.smembers(setKey)),
    );

    const keys = Array.from(new Set(memberLists.flat()));

    for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
      await client.del(...keys.slice(i, i + DELETE_BATCH_SIZE));
    }

    await client.del(...setKeys);
  } catch (error: any) {
    logger.error({
      message: "Cache invalidation failed",
      tags,
      error: error?.message,
    });
  }
};

/** Convenience wrapper so controllers can invalidate without building arrays. */
export const invalidateCache = (...tags: string[]) => invalidateCacheTags(tags);
