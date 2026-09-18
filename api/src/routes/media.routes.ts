import { Router } from "express";
import {
  createMediaItem,
  deleteMediaItem,
  getAllMediaItem,
  getSingleMediaItem,
  updateMediaItem,
} from "../controllers/media.controller";
import { rateLimits } from "../middleware/rateLimits";

export const mediaItem = Router();

// NOTE: none of these routes check a token. The limits below cap how fast the
// media library can be read or rewritten, but they are not a substitute for
// the authorisation the write routes are missing.
mediaItem
  .get("/", rateLimits.publicReadUncached, getAllMediaItem)
  .get("/:media_item_id", rateLimits.publicReadUncached, getSingleMediaItem)
  .post("/", rateLimits.mediaWrite, createMediaItem)
  .put("/:media_item_id", rateLimits.mediaWrite, updateMediaItem)
  .delete("/:media_item_id", rateLimits.mediaWrite, deleteMediaItem);
