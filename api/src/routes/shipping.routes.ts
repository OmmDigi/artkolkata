import { Router } from "express";
import { checkServiceability } from "../controllers/shipping.controller";
import { cacheResponse } from "../middleware/cacheResponse";
import { CACHE_TAGS } from "../services/cache.service";
import { rateLimits } from "../middleware/rateLimits";

export const shippingRoutes = Router();

// This one is a paid call out to the shipping partner, not a database read, and the answer
// for a given pincode/weight/value moves at courier-network speed rather than
// admin-edit speed. Nothing in the api can invalidate it, so it only expires.
shippingRoutes.get(
  "/check-serviceability",
  // A cache miss here spends the store's money, not just its cpu, so this is
  // limited harder than an ordinary public read.
  rateLimits.serviceability,
  cacheResponse({ tags: [CACHE_TAGS.SERVICEABILITY], ttl: 900 }),
  checkServiceability,
);
