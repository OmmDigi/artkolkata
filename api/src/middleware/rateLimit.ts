import { NextFunction, Response } from "express";
import crypto from "crypto";
import { CustomRequest } from "../types";
import { ErrorHandler } from "../utils/ErrorHandler";
import asyncErrorHandler from "./asyncErrorHandler";
import { consumeRateLimit } from "../services/rateLimit.service";
import logger from "../utils/logger";

/**
 * Per-route request throttling.
 *
 * nginx already caps raw requests per ip in front of this process, but that
 * limit is deliberately loose (it has to pass a page load's worth of parallel
 * api calls) and it cannot tell a product listing apart from a login attempt.
 * A password or coupon brute force stays comfortably under it. This layer is
 * where the expensive and abusable endpoints get the tight, specific limits
 * they actually need.
 *
 * Every limiter fails open. If the counter cannot be read the request is
 * served, because dropping real orders is a worse outcome than briefly not
 * counting requests.
 */

/**
 * A single escape hatch for local work and load tests. It is opt-in and off
 * unless the variable is exactly "true", so a typo can never silently disable
 * every limit in production.
 */
const DISABLED = process.env.RATE_LIMIT_DISABLED === "true";

/**
 * Scales every limit at once, for the day traffic outgrows these numbers and
 * the answer is "same shape, more headroom". Values below 1 tighten instead.
 */
const FACTOR = Math.max(0.1, parseFloat(process.env.RATE_LIMIT_FACTOR ?? "1"));

export interface IRateLimitOptions {
  /**
   * Namespace for the counter. Two limiters on the same route with the same
   * name would share a bucket, so this must be unique per limiter.
   */
  name: string;
  /** requests allowed per window, before RATE_LIMIT_FACTOR is applied */
  limit: number;
  windowSeconds: number;
  /** shown to the client on a 429 */
  message?: string;
  /**
   * "auto" buckets a logged-in caller by user id and everyone else by ip.
   * "ip" forces ip even for logged-in callers, for limits that exist to stop
   * one machine hammering a shared resource.
   */
  identity?: "auto" | "ip";
  /**
   * Extra scope mixed into the key, so one bucket can be kept per target
   * rather than per caller — the account being logged into, for instance.
   * Return null to fall back to the caller-only key.
   */
  scope?: (req: CustomRequest) => string | null | undefined;
  /** skip the limiter entirely for this request */
  skip?: (req: CustomRequest) => boolean;
}

/**
 * The caller's address, as express resolved it.
 *
 * This is only trustworthy because index.ts sets "trust proxy". Without that
 * every request behind nginx reports the proxy's own container ip, every
 * visitor shares one bucket, and the first shopper of the minute locks out
 * the rest. If ip-keyed limits ever start firing for everyone at once, that
 * setting is the first thing to check.
 */
const resolveIp = (req: CustomRequest) => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";

  // ::ffff:1.2.3.4 and 1.2.3.4 are the same client and must not get two
  // separate allowances.
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
};

/**
 * Values that end up in a key can be attacker-controlled and arbitrarily long
 * (an "email" field is whatever was posted), so they are hashed rather than
 * concatenated raw. That bounds the key length and keeps addresses out of
 * plain sight in redis.
 */
const digest = (value: string) =>
  crypto
    .createHash("sha1")
    .update(value.toLowerCase().trim())
    .digest("hex")
    .slice(0, 20);

const buildKey = (req: CustomRequest, options: IRateLimitOptions) => {
  const identity =
    options.identity !== "ip" && req.token_info?.id
      ? `u:${req.token_info.id}`
      : `ip:${resolveIp(req)}`;

  const scope = options.scope?.(req);

  return scope
    ? `rl:${options.name}:${identity}:s:${digest(scope)}`
    : `rl:${options.name}:${identity}`;
};

export const rateLimit = (options: IRateLimitOptions) => {
  const limit = Math.max(1, Math.round(options.limit * FACTOR));
  const { windowSeconds, name } = options;

  return asyncErrorHandler(
    async (req: CustomRequest, res: Response, next: NextFunction) => {
      if (DISABLED) return next();

      if (options.skip?.(req)) return next();

      const key = buildKey(req, options);

      const result = await consumeRateLimit(key, windowSeconds);

      // Could not count it. Serve it.
      if (!result) return next();

      const remaining = Math.max(0, limit - result.count);

      res.setHeader("RateLimit-Limit", limit);
      res.setHeader("RateLimit-Remaining", remaining);
      res.setHeader("RateLimit-Reset", result.resetSeconds);

      if (result.count <= limit) return next();

      res.setHeader("Retry-After", result.resetSeconds);

      logger.warn({
        message: "Rate limit exceeded",
        limiter: name,
        count: result.count,
        limit,
        url: req.originalUrl,
        method: req.method,
        ip: resolveIp(req),
        user_id: req.token_info?.id ?? null,
      });

      throw new ErrorHandler(
        429,
        options.message ??
          "Too many requests. Please wait a moment and try again.",
      );
    },
  );
};
