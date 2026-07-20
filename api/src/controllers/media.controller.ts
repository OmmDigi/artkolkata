import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { deleteFile } from "../utils/deleteFile";
import { ErrorHandler } from "../utils/ErrorHandler";
import { generatePlaceholders } from "../utils/generatePlaceholders";
import { httpResponse } from "../utils/httpResponse";
import { parsePagination } from "../utils/parsePagination";
import {
  VCreateMediaItem,
  VSingleMediaItem,
  VUpdateMediaItem,
} from "../validator/media.validator";

const cache = new Map();

const GALLERY_ITEM_COUNT_KEY = "gallery-item-count";

export const getAllMediaItem = asyncErrorHandler(async (req, res) => {
  const GET_LIMIT = 12;
  const { LIMIT, OFFSET } = parsePagination(req, GET_LIMIT);

  // for cache the gallery total items
  let totalCount = 0;
  if (!cache.has(GALLERY_ITEM_COUNT_KEY)) {
    const { rows: totalItems, rowCount } = await pool.query(
      "SELECT COUNT(media_item_id) AS total FROM media_items"
    );
    if (rowCount === 0) {
      totalCount = 0;
    } else {
      totalCount = totalItems[0].total;
    }
    cache.set(GALLERY_ITEM_COUNT_KEY, totalCount);
  } else {
    totalCount = cache.get(GALLERY_ITEM_COUNT_KEY);
  }
  const TOTAL_PAGE = Math.ceil(totalCount / GET_LIMIT);

  const { rows } = await pool.query(
    `SELECT * FROM media_items ORDER BY media_item_id DESC LIMIT ${LIMIT} OFFSET ${OFFSET}`
  );

  httpResponse(res, 200, "All gallery list", rows, undefined, TOTAL_PAGE);
});

export const getSingleMediaItem = asyncErrorHandler(async (req, res) => {
  const { error, value } = VSingleMediaItem.validate(req.params ?? {});
  if (error)
    throw new ErrorHandler(400, error.message, [
      error.details[0].context?.key?.toString() ?? "",
    ]);

  const { rowCount, rows } = await pool.query(
    "SELECT * FROM media_items WHERE media_item_id = $1",
    [value.media_item_id]
  );
  if (rowCount === 0)
    throw new ErrorHandler(400, "No Media Item Found With This Id");

  httpResponse(res, 200, "Single Media Item Info", rows[0]);
});

export const createMediaItem = asyncErrorHandler(async (req, res) => {
  const { error, value } = VCreateMediaItem.validate(req.body || []);
  if (error)
    throw new ErrorHandler(400, error.message, [
      error.details[0].context?.key ?? "",
    ]);

  if (value.length === 0) throw new ErrorHandler(400, "Empty value for store");

  const placeholders = generatePlaceholders(value.length, 3);
  const { rows } = await pool.query(
    `INSERT INTO media_items (media_type, item_link, alt_tag) VALUES ${placeholders}`,
    value.flatMap((item) => [item.media_type, item.item_link, item.alt_tag])
  );

  // for cache the gallery total items
  const galleryItems = cache.get(GALLERY_ITEM_COUNT_KEY) || 0;
  cache.set(GALLERY_ITEM_COUNT_KEY, galleryItems + value.length);

  httpResponse(res, 201, "New media item has created", rows);
});

export const updateMediaItem = asyncErrorHandler(async (req, res) => {
  const { error, value } = VUpdateMediaItem.validate({
    ...req.params,
    ...req.body,
  });
  if (error)
    throw new ErrorHandler(400, error.message, [
      error.details[0].context?.key ?? "",
    ]);

  await pool.query(
    "UPDATE media_items SET media_type = $1, item_link = $2, alt_tag = $3 WHERE media_item_id = $4",
    [value.media_type, value.item_link, value.alt_tag, value.media_item_id]
  );

  httpResponse(res, 200, "Update media item");
});

export const deleteMediaItem = asyncErrorHandler(async (req, res) => {
  const { error, value } = VSingleMediaItem.validate(req.params);
  if (error)
    throw new ErrorHandler(400, error.message, [
      error.details[0].context?.key ?? "",
    ]);

  const { rowCount, rows } = await pool.query(
    "DELETE FROM media_items WHERE media_item_id = $1 RETURNING item_link",
    [value.media_item_id]
  );

  //delete the image form upload-file server
  if (rowCount && rowCount > 0 && rows[0].item_link) {
    deleteFile(rows[0].item_link);
  }

  // for cache the gallery total items
  const galleryItems = cache.get(GALLERY_ITEM_COUNT_KEY) || 0;
  cache.set(GALLERY_ITEM_COUNT_KEY, galleryItems - 1);

  httpResponse(res, 200, "Media item has been deleted");
});
