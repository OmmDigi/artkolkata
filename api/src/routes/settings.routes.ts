import { Router } from "express";
import {
  createBanner,
  createShippingRule,
  deleteBanner,
  deleteShippingRule,
  getBanners,
  getShippingRules,
  getSingleShippingRule,
  getSiteInfo,
  reorderBanners,
  saveSiteInfo,
  updateBanner,
  updateShippingRule,
} from "../controllers/settings.controller";
import { checkUser } from "../middleware/checkUser";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { cacheResponse } from "../middleware/cacheResponse";
import { CACHE_TAGS } from "../services/cache.service";
import { rateLimits } from "../middleware/rateLimits";

export const settingsRoute = Router();

settingsRoute
  // site info : logo, contact emails, phones, addresses
  .get(
    "/site-info",
    rateLimits.publicRead,
    cacheResponse({ tags: [CACHE_TAGS.SITE_INFO] }),
    getSiteInfo,
  )
  .post(
    "/site-info",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-13"]),
    saveSiteInfo,
  )

  // website banners
  .get(
    "/banners",
    rateLimits.publicRead,
    cacheResponse({ tags: [CACHE_TAGS.BANNERS] }),
    getBanners,
  )
  .post(
    "/banners",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-13"]),
    createBanner,
  )
  .put(
    "/banners/reorder",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-13"]),
    reorderBanners,
  )
  .put(
    "/banners/:banner_id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-13"]),
    updateBanner,
  )
  .delete(
    "/banners/:banner_id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-13"]),
    deleteBanner,
  )

  // conditional shipping charge slabs.
  // the list is open to the storefront (so it can advertise the free shipping
  // threshold) but only admins get the disabled and scheduled rows back
  .get(
    "/shipping-rules",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.SHIPPING_RULES],
      adminPermissions: ["1-13"],
    }),
    getShippingRules,
  )
  .post(
    "/shipping-rules",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-13"]),
    createShippingRule,
  )
  .get(
    "/shipping-rules/:id",
    rateLimits.adminRead,
    isAuthorizedV2(["1-13"]),
    getSingleShippingRule,
  )
  .put(
    "/shipping-rules/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-13"]),
    updateShippingRule,
  )
  .delete(
    "/shipping-rules/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-13"]),
    deleteShippingRule,
  );
