import { Router } from "express";
import {
  createVideo,
  deleteVideo,
  getPrimaryVideo,
  getSingleVideo,
  getVideos,
  reorderVideos,
  updateVideo,
} from "../controllers/video.controller";
import { cacheResponse } from "../middleware/cacheResponse";
import { checkUser } from "../middleware/checkUser";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { rateLimits } from "../middleware/rateLimits";
import { CACHE_TAGS } from "../services/cache.service";

export const videoRoutes = Router();

// the lists are open to the storefront, but only the CMS gets hidden videos
// back, and those responses are kept out of the cache
const publicVideoCache = cacheResponse({
  tags: [CACHE_TAGS.VIDEOS],
  adminPermissions: ["1-16"],
});

videoRoutes
  .get("/", rateLimits.publicRead, checkUser, publicVideoCache, getVideos)
  // declared before "/:id", otherwise "primary" and "reorder" are read as ids
  .get(
    "/primary",
    rateLimits.publicRead,
    checkUser,
    publicVideoCache,
    getPrimaryVideo,
  )
  .put(
    "/reorder",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-16"]),
    reorderVideos,
  )
  .get("/:id", rateLimits.publicRead, checkUser, publicVideoCache, getSingleVideo)
  .post("/", rateLimits.adminWrite, isAuthorizedV2(["1-16"]), createVideo)
  .put("/:id", rateLimits.adminWrite, isAuthorizedV2(["1-16"]), updateVideo)
  .delete("/:id", rateLimits.adminWrite, isAuthorizedV2(["1-16"]), deleteVideo);
