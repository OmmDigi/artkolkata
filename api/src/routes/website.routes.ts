import { Router } from "express";
import {
  addEnquiry,
  getEnquiry,
  getSiteMapList,
} from "../controllers/website.controller";
import {
  addProductEnquiry,
  deleteProductEnquiry,
  getProductEnquiries,
  updateProductEnquiryStatus,
} from "../controllers/productEnquiry.controller";
import { cacheResponse } from "../middleware/cacheResponse";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { CACHE_TAGS } from "../services/cache.service";
import { rateLimits } from "../middleware/rateLimits";

export const websiteRoute = Router();

websiteRoute
  // every customer's name, email and phone: staff with the Inquiries
  // permission only. The storefront only ever posts to this path.
  .get("/enquiry", rateLimits.adminRead, isAuthorizedV2(["1-10"]), getEnquiry)
  // Unauthenticated, stored, and mailed onward — the classic spam target.
  .post("/enquiry", rateLimits.enquiry, addEnquiry)

  // product enquiries: the storefront posts, the CMS Inquiries page manages
  .post("/product-enquiry", rateLimits.productEnquiry, addProductEnquiry)
  .get(
    "/product-enquiry",
    rateLimits.adminRead,
    isAuthorizedV2(["1-10"]),
    getProductEnquiries,
  )
  .patch(
    "/product-enquiry/:id/status",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-10"]),
    updateProductEnquiryStatus,
  )
  .delete(
    "/product-enquiry/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-10"]),
    deleteProductEnquiry,
  )

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
