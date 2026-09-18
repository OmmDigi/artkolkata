import { Router } from "express";
import {
  getDashboardKpi,
  getOrderStatusBreakdown,
  getSalesTimeseries,
  getTopProducts,
} from "../controllers/analytics.controller";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { rateLimits } from "../middleware/rateLimits";
import { ORDERS_PERMISSION_ID } from "../constant";

/**
 * Guarded by the Orders permission rather than a new one of its own. Every
 * number these endpoints return is derived from orders, so anyone who can
 * already open the Orders screen can already read all of it, one page at a
 * time — a separate permission would not be withholding anything.
 *
 * The day the CMS grows a Dashboard entry in SIDEBAR_OPTIONS, this becomes
 * that entry's id instead, and RoteIds in types.ts gains it.
 *
 * Not cached: cacheResponse deliberately bypasses the cache for privileged
 * requests, and every request that reaches here is one.
 */
export const analyticsRoutes = Router();

analyticsRoutes
  .get(
    "/kpi",
    rateLimits.adminRead,
    isAuthorizedV2([ORDERS_PERMISSION_ID]),
    getDashboardKpi,
  )
  .get(
    "/timeseries",
    rateLimits.adminRead,
    isAuthorizedV2([ORDERS_PERMISSION_ID]),
    getSalesTimeseries,
  )
  .get(
    "/top-products",
    rateLimits.adminRead,
    isAuthorizedV2([ORDERS_PERMISSION_ID]),
    getTopProducts,
  )
  .get(
    "/order-status",
    rateLimits.adminRead,
    isAuthorizedV2([ORDERS_PERMISSION_ID]),
    getOrderStatusBreakdown,
  );
