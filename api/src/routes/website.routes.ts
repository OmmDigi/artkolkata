import { Router } from "express";
import {
  addEnquiry,
  getEnquiry,
  getSiteMapList,
} from "../controllers/website.controller";
import { cacheResponse } from "../middleware/cacheResponse";
import { CACHE_TAGS } from "../services/cache.service";
import { rateLimits } from "../middleware/rateLimits";

export const websiteRoute = Router();

websiteRoute
  .get("/enquiry", rateLimits.publicReadUncached, getEnquiry)
  // Unauthenticated, stored, and mailed onward — the classic spam target.
  .post("/enquiry", rateLimits.enquiry, addEnquiry)
  .get(
    "/sitemap.xml",
    rateLimits.sitemap,
    cacheResponse({
      tags: [CACHE_TAGS.SITEMAP, CACHE_TAGS.PRODUCTS, CACHE_TAGS.BLOGS],
      // crawlers hit this rarely and it is a full table scan of two tables,
      // so it earns a much longer window than a storefront listing
      ttl: 3600,
    }),
    getSiteMapList,
  );
