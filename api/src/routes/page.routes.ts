import { Router } from "express";
import {
  getSitePage,
  getSitePageList,
  updateSitePage,
} from "../controllers/page.controller";
import { checkUser } from "../middleware/checkUser";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { cacheResponse } from "../middleware/cacheResponse";
import { CACHE_TAGS } from "../services/cache.service";
import { rateLimits } from "../middleware/rateLimits";

export const pageRoutes = Router();

/**
 * The legal pages: terms, privacy, returns and refunds.
 *
 * Read is open — these are the pages the footer links to — and checkUser only
 * runs so the CMS, which holds the settings permission, gets drafts back too.
 * There is no create and no delete: the three rows are seeded by the schema
 * and only their content is editable, so a footer link can never 404 because
 * someone removed a page.
 */
pageRoutes
  .get(
    "/",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.SITE_PAGES],
      adminPermissions: ["1-13"],
    }),
    getSitePageList,
  )
  .get(
    "/:slug",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.SITE_PAGES],
      adminPermissions: ["1-13"],
    }),
    getSitePage,
  )
  .put(
    "/:slug",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-13"]),
    updateSitePage,
  );
