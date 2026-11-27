import { PoolClient } from "pg";
import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { CACHE_TAGS, invalidateCache } from "../services/cache.service";
import { CustomRequest } from "../types";
import { checkPermission } from "../utils/checkPermissions";
import { deleteFile } from "../utils/deleteFile";
import { doTransition } from "../utils/doTransition";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import {
  extractYouTubeId,
  youTubeThumbnailUrl,
  youTubeWatchUrl,
} from "../utils/youtube";
import {
  VCreateVideo,
  VReorderVideos,
  VUpdateVideo,
  VVideoId,
} from "../validator/video.validator";

export type TVideoSource = "upload" | "youtube";

export interface IVideo {
  id: number;
  title: string;
  description: string | null;
  source_type: TVideoSource;
  video_url: string;
  youtube_id: string | null;
  thumbnail_url: string | null;
  is_primary: boolean;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

interface IVideoInput {
  title: string;
  description?: string | null;
  source_type: TVideoSource;
  video_url: string;
  thumbnail_url?: string | null;
  is_primary: boolean;
  is_active: boolean;
}

const VIDEO_COLUMNS = `id, title, description, source_type, video_url, youtube_id,
  thumbnail_url, is_primary, is_active, position, created_at, updated_at`;

/**
 * The CMS lists hidden videos too, a shopper must not see them. Same test
 * cacheResponse uses to decide a request is privileged, so the two can never
 * disagree and cache an admin's view of the list for the public.
 */
const canSeeHidden = (req: CustomRequest) => {
  const tokenInfo = req.token_info;
  if (!tokenInfo) return false;
  if (tokenInfo.role && tokenInfo.role !== "User") return true;
  return checkPermission(tokenInfo.permissions ?? null, ["1-16"], "or");
};

// An empty string from the form is "not set", not a value worth storing.
const orNull = (value?: string | null) =>
  value === undefined || value === null || value.trim() === ""
    ? null
    : value.trim();

/**
 * The row as it is stored. A YouTube link is reduced to its id and saved as
 * the canonical watch link, whatever form the admin pasted, and it gets
 * YouTube's own thumbnail when the CMS sent none.
 */
const toVideoRow = (value: IVideoInput) => {
  if (value.is_primary && !value.is_active) {
    throw new ErrorHandler(
      400,
      "A hidden video can't be the primary video. Show it on the website first, or mark another video as primary.",
    );
  }

  const common = {
    title: value.title,
    description: orNull(value.description),
    source_type: value.source_type,
    is_primary: value.is_primary,
    is_active: value.is_active,
  };

  if (value.source_type === "youtube") {
    const youtubeId = extractYouTubeId(value.video_url);
    if (!youtubeId) {
      throw new ErrorHandler(
        400,
        "That doesn't look like a YouTube video link. Paste a link such as https://www.youtube.com/watch?v=…",
        ["video_url"],
      );
    }

    return {
      ...common,
      video_url: youTubeWatchUrl(youtubeId),
      youtube_id: youtubeId,
      thumbnail_url:
        orNull(value.thumbnail_url) ?? youTubeThumbnailUrl(youtubeId),
    };
  }

  return {
    ...common,
    video_url: value.video_url.trim(),
    youtube_id: null,
    thumbnail_url: orNull(value.thumbnail_url),
  };
};

/**
 * Only one video may be primary (a partial unique index enforces it), so the
 * old one is cleared before the new one is set, inside the same transaction.
 *
 * The advisory lock serialises two admins doing this at the same moment.
 * Without it both would clear, both would set, and the second would fail on
 * the index with an error that means nothing to the person who saw it.
 */
const clearPrimary = async (client: PoolClient, exceptId = 0) => {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('videos_primary'))");
  await client.query(
    `UPDATE videos SET is_primary = FALSE, updated_at = NOW()
     WHERE is_primary AND id <> $1`,
    [exceptId],
  );
};

/**
 * Removes a file from the upload server, but only one this tab uploaded.
 * The CMS also lets an admin paste any asset link as a thumbnail, and that
 * file may belong to a product or a banner: deleting it here would break
 * that page. YouTube links never match either.
 */
const removeVideoTabFile = (url?: string | null) => {
  if (url && /(^|\/)uploads\/videos\//.test(url)) deleteFile(url);
};

export const getVideos = asyncErrorHandler(async (req: CustomRequest, res) => {
  const { rows } = await pool.query<IVideo>(
    `SELECT ${VIDEO_COLUMNS}
     FROM videos
     ${canSeeHidden(req) ? "" : "WHERE is_active"}
     ORDER BY position ASC, id ASC`,
  );

  httpResponse(res, 200, "Video list", rows);
});

// the featured video. data is null when none is marked primary
export const getPrimaryVideo = asyncErrorHandler(async (_, res) => {
  const { rows } = await pool.query<IVideo>(
    `SELECT ${VIDEO_COLUMNS} FROM videos WHERE is_primary AND is_active LIMIT 1`,
  );

  httpResponse(
    res,
    200,
    rows.length > 0 ? "Primary video" : "No primary video is set",
    rows[0] ?? null,
  );
});

export const getSingleVideo = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const { id } = doValidate<{ id: number }>(VVideoId, { id: req.params.id });

    const { rows } = await pool.query<IVideo>(
      `SELECT ${VIDEO_COLUMNS} FROM videos
       WHERE id = $1 ${canSeeHidden(req) ? "" : "AND is_active"}`,
      [id],
    );

    if (rows.length === 0)
      throw new ErrorHandler(404, "No video found with this id");

    httpResponse(res, 200, "Single video", rows[0]);
  },
);

export const createVideo = asyncErrorHandler(async (req, res) => {
  const row = toVideoRow(
    doValidate<IVideoInput>(VCreateVideo, req.body ?? {}, {
      stripUnknown: true,
    }),
  );

  let created: IVideo | undefined;

  await doTransition(async (client) => {
    if (row.is_primary) await clearPrimary(client);

    // a new video goes to the end of the list, the admin drags it from there
    const { rows } = await client.query<IVideo>(
      `INSERT INTO videos
         (title, description, source_type, video_url, youtube_id,
          thumbnail_url, is_primary, is_active, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
         (SELECT COALESCE(MAX(position), 0) + 1 FROM videos))
       RETURNING ${VIDEO_COLUMNS}`,
      [
        row.title,
        row.description,
        row.source_type,
        row.video_url,
        row.youtube_id,
        row.thumbnail_url,
        row.is_primary,
        row.is_active,
      ],
    );

    created = rows[0];
  });

  await invalidateCache(CACHE_TAGS.VIDEOS);
  httpResponse(res, 201, "Video has been added", created);
});

export const updateVideo = asyncErrorHandler(async (req, res) => {
  const { id, ...input } = doValidate<IVideoInput & { id: number }>(
    VUpdateVideo,
    { ...req.body, id: Number(req.params.id) },
    // the list toggles send the row back as they got it, position and all
    { stripUnknown: true },
  );
  const row = toVideoRow(input);

  let previous:
    | { previous_video_url: string; previous_thumbnail_url: string | null }
    | undefined;

  await doTransition(async (client) => {
    if (row.is_primary) await clearPrimary(client, id);

    // the CTE reads the pre-update snapshot, so it hands back the files we replaced
    const { rows } = await client.query(
      `WITH previous AS (
         SELECT video_url, thumbnail_url FROM videos WHERE id = $9
       )
       UPDATE videos
       SET title = $1, description = $2, source_type = $3, video_url = $4,
           youtube_id = $5, thumbnail_url = $6, is_primary = $7,
           is_active = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING (SELECT video_url FROM previous) AS previous_video_url,
                 (SELECT thumbnail_url FROM previous) AS previous_thumbnail_url`,
      [
        row.title,
        row.description,
        row.source_type,
        row.video_url,
        row.youtube_id,
        row.thumbnail_url,
        row.is_primary,
        row.is_active,
        id,
      ],
    );

    // throwing here also rolls back the primary flag cleared above
    if (rows.length === 0)
      throw new ErrorHandler(404, "No video found with this id");

    previous = rows[0];
  });

  // drop the old files once nothing points at them any more
  if (previous) {
    if (previous.previous_video_url !== row.video_url)
      removeVideoTabFile(previous.previous_video_url);
    if (previous.previous_thumbnail_url !== row.thumbnail_url)
      removeVideoTabFile(previous.previous_thumbnail_url);
  }

  await invalidateCache(CACHE_TAGS.VIDEOS);
  httpResponse(res, 200, "Video has been updated");
});

export const deleteVideo = asyncErrorHandler(async (req, res) => {
  const { id } = doValidate<{ id: number }>(VVideoId, { id: req.params.id });

  const { rows } = await pool.query<{
    video_url: string;
    thumbnail_url: string | null;
  }>(
    `DELETE FROM videos WHERE id = $1 RETURNING video_url, thumbnail_url`,
    [id],
  );

  if (rows.length === 0)
    throw new ErrorHandler(404, "No video found with this id");

  removeVideoTabFile(rows[0].video_url);
  removeVideoTabFile(rows[0].thumbnail_url);

  await invalidateCache(CACHE_TAGS.VIDEOS);
  httpResponse(res, 200, "Video has been deleted");
});

export const reorderVideos = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{ videos: { id: number; position: number }[] }>(
    VReorderVideos,
    req.body ?? {},
  );

  // one statement, so a half applied order is never visible
  await pool.query(
    `UPDATE videos v
     SET position = item.position, updated_at = NOW()
     FROM jsonb_to_recordset($1::jsonb) AS item(id INTEGER, position INTEGER)
     WHERE v.id = item.id`,
    [JSON.stringify(value.videos)],
  );

  await invalidateCache(CACHE_TAGS.VIDEOS);
  httpResponse(res, 200, "Video order has been updated");
});
