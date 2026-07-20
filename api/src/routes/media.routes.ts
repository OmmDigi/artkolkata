import { Router } from "express";
import {
  createMediaItem,
  deleteMediaItem,
  getAllMediaItem,
  getSingleMediaItem,
  updateMediaItem,
} from "../controllers/media.controller";

export const mediaItem = Router();

mediaItem
  .get("/", getAllMediaItem)
  .get("/:media_item_id", getSingleMediaItem)
  .post("/", createMediaItem)
  .put("/:media_item_id", updateMediaItem)
  .delete("/:media_item_id", deleteMediaItem);
