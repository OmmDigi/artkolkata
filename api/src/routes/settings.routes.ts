import { Router } from "express";
import {
  createBanner,
  deleteBanner,
  getBanners,
  getSiteInfo,
  reorderBanners,
  saveSiteInfo,
  updateBanner,
} from "../controllers/settings.controller";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";

export const settingsRoute = Router();

settingsRoute
  // site info : logo, contact emails, phones, addresses
  .get("/site-info", getSiteInfo)
  .post("/site-info", isAuthorizedV2(["1-13"]), saveSiteInfo)

  // website banners
  .get("/banners", getBanners)
  .post("/banners", isAuthorizedV2(["1-13"]), createBanner)
  .put("/banners/reorder", isAuthorizedV2(["1-13"]), reorderBanners)
  .put("/banners/:banner_id", isAuthorizedV2(["1-13"]), updateBanner)
  .delete("/banners/:banner_id", isAuthorizedV2(["1-13"]), deleteBanner);
