import { NextFunction, Response } from "express";
import crypto from "crypto";
import { CustomRequest, RoteIds } from "../types";
import { checkPermission } from "../utils/checkPermissions";
import { isCacheReady } from "../config/redis";
import {
  DEFAULT_CACHE_TTL,
  getCachedResponse,
  setCachedResponse,
} from "../services/cache.service";

interface ICacheRouteOptions {
  /** tags this response is built from, and therefore dies with */
  tags: readonly string[];
  /** seconds to keep the entry, defaults to DEFAULT_CACHE_TTL */
  ttl?: number;
  /**
   * Permission codes that make a request "privileged" on this route — the same
   * codes the handler itself checks to decide whether to include hidden rows.
   * A request holding them bypasses the cache in both directions.
   */
  adminPermissions?: RoteIds[];
}

/**
 * A privileged request sees rows a shopper must never see: unpublished
 * products, hidden categories, pending reviews, disabled shipping rules.
 * Those responses are neither served from nor written to the cache, so there
 * is no key an anonymous request could ever collide with. Admin traffic is a
 * rounding error next to storefront traffic, and it gets to stay perfectly
 * fresh.
 */
const isPrivilegedRequest = (
  req: CustomRequest,
  adminPermissions: RoteIds[],
) => {
  const tokenInfo = req.token_info;

  if (!tokenInfo) return false;

  // Anything that is not a plain customer already reads with wider visibility
  // (getSingleProduct drops its status filter on any non-"User" role).
  if (tokenInfo.role && tokenInfo.role !== "User") return true;

  if (
    adminPermissions.length > 0 &&
    checkPermission(tokenInfo.permissions ?? null, adminPermissions, "or")
  ) {
    return true;
  }

  return false;
};

/**
 * Query strings arrive in whatever order the client felt like, and
 * ?a=1&b=2 must not get a different cache entry from ?b=2&a=1. Sorting keys
 * (and repeated values) makes the key canonical.
 */
const canonicalQuery = (query: Record<string, any>) => {
  const parts: string[] = [];

  Object.keys(query)
    .sort()
    .forEach((key) => {
      const value = query[key];

      if (Array.isArray(value)) {
        parts.push(`${key}=${[...value].map(String).sort().join(",")}`);
      } else if (value !== undefined) {
        parts.push(`${key}=${String(value)}`);
      }
    });

  return parts.join("&");
};

const buildCacheKey = (req: CustomRequest) => {
  const path = `${req.baseUrl}${req.path}`;
  const query = canonicalQuery(req.query as Record<string, any>);

  // Hashing keeps the key a fixed, sane length no matter how long the filter
  // query gets. The readable path prefix stays so keys can be eyeballed in
  // redis-cli.
  const digest = crypto
    .createHash("sha1")
    .update(`${path}?${query}`)
    .digest("hex");

  return `res:${path}:${digest}`;
};

/**
 * Cache a GET response in redis and replay it on the next identical request.
 *
 * Fails open at every step: no redis, a dead socket, a serialisation error —
 * the request simply runs the handler as it always did.
 */
export const cacheResponse = ({
  tags,
  ttl = DEFAULT_CACHE_TTL,
  adminPermissions = [],
}: ICacheRouteOptions) => {
  return async (req: CustomRequest, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();

    if (!isCacheReady()) return next();

    if (isPrivilegedRequest(req, adminPermissions)) {
      res.setHeader("X-Cache", "BYPASS");
      return next();
    }

    const key = buildCacheKey(req);

    const hit = await getCachedResponse(key);

    if (hit) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Content-Type", hit.contentType);
      res.status(hit.status).send(hit.body);
      return;
    }

    res.setHeader("X-Cache", "MISS");

    const originalSend = res.send.bind(res);

    // res.json() ends up in res.send() with the body already serialised and
    // the content type already set, so wrapping send alone covers both the
    // json endpoints and the xml sitemap.
    res.send = ((body: any) => {
      const result = originalSend(body);

      const isCacheable =
        typeof body === "string" &&
        res.statusCode >= 200 &&
        res.statusCode < 300;

      if (isCacheable) {
        const contentType =
          (res.getHeader("Content-Type") as string) ??
          "application/json; charset=utf-8";

        // Deliberately not awaited: the response has already gone out, and a
        // slow redis must not hold the request open. Errors are swallowed and
        // logged inside setCachedResponse.
        void setCachedResponse({
          key,
          value: { status: res.statusCode, contentType, body },
          ttl,
          tags,
        });
      }

      return result;
    }) as Response["send"];

    next();
  };
};
